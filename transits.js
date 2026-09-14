/* ════════════════════════════════════════════════════════════════════════
   Live Transits Engine — Spengeman Family Natal Site
   Uses Astronomy Engine (MIT licensed, self-hosted in astronomy.min.js)
   to calculate real-time planetary positions and compare them against
   each family member's natal chart, entirely in the browser.
   ════════════════════════════════════════════════════════════════════════ */

const NATAL_DATA = {
  Dan:      { Sun:132.0, Moon:290.0, Mercury:124.0, Venus:111.0, Mars:186.0, Jupiter:213.0, Saturn:195.0, Uranus:243.0, Neptune:255.0, Pluto:204.0, ASC:268.0 },
  Michelle: { Sun:50.9,  Moon:22.2,  Mercury:24.9,  Venus:93.4,  Mars:111.6, Jupiter:126.2, Saturn:306.8, Uranus:283.6, Neptune:286.6, Pluto:228.9, ASC:255.8 },
  Lillian:  { Sun:80.5,  Moon:278.7, Mercury:68.2,  Venus:35.0,  Mars:94.3,  Jupiter:193.2, Saturn:264.8, Uranus:27.4,  Neptune:344.3, Pluto:298.8, ASC:345.4 },
  Nolan:    { Sun:272.4, Moon:251.4, Mercury:261.9, Venus:305.2, Mars:233.4, Jupiter:275.0, Saturn:290.5, Uranus:32.8,  Neptune:286.1, Pluto:292.2, ASC:275.5 },
  Maybelle: { Sun:42.7,  Moon:68.6,  Mercury:62.5,  Venus:0.6,   Mars:343.6, Jupiter:28.4,  Saturn:294.4, Uranus:44.7,  Neptune:294.6, Pluto:298.6, ASC:274.8 },
};

const ZODIAC_SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];

function degToSign(deg) {
  const idx = Math.floor(deg / 30) % 12;
  const d = deg % 30;
  return { sign: ZODIAC_SIGNS[idx], degree: Math.round(d * 10) / 10 };
}

// Transiting bodies worth tracking — outer/slow planets stay "in aspect" for
// days to weeks, which is what makes a transit meaningful to read about.
// Fast bodies (Moon, and usually Mercury/Venus) are excluded — they change
// aspect within hours, which would make the page noisy and stale within a day.
const TRANSIT_BODIES = [
  { key: 'Sun',     orb: 1.0,  label: 'Sun' },
  { key: 'Mars',    orb: 3.0,  label: 'Mars' },
  { key: 'Jupiter', orb: 3.0,  label: 'Jupiter' },
  { key: 'Saturn',  orb: 2.5,  label: 'Saturn' },
  { key: 'Uranus',  orb: 2.0,  label: 'Uranus' },
  { key: 'Neptune', orb: 2.0,  label: 'Neptune' },
  { key: 'Pluto',   orb: 2.0,  label: 'Pluto' },
];

const NATAL_POINTS = ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto','ASC'];

const ASPECTS = [
  { name: 'Conjunction', symbol: '☌', angle: 0,   quality: 'Union' },
  { name: 'Sextile',     symbol: '⚹', angle: 60,  quality: 'Harmony' },
  { name: 'Square',      symbol: '□', angle: 90,  quality: 'Tension' },
  { name: 'Trine',       symbol: '△', angle: 120, quality: 'Flow' },
  { name: 'Opposition',  symbol: '☍', angle: 180, quality: 'Polarity' },
];

const QUALITY_COLOR = {
  Union: '#DAA520', Harmony: '#4a6fa5', Tension: '#b56b7a', Flow: '#4a8b7a', Polarity: '#8b6b9e'
};

const TRANSIT_PLANET_MEANING = {
  Sun:     'vitality, visibility and where your energy is currently focused',
  Mars:    'drive, assertiveness and where action is currently being called for',
  Jupiter: 'expansion, opportunity and where growth is currently favored',
  Saturn:  'structure, tests and where real, lasting commitment is being asked of you',
  Uranus:  'sudden change, awakening and where you\u2019re being nudged toward authenticity',
  Neptune: 'dissolution, inspiration and where boundaries are currently softening',
  Pluto:   'transformation, intensity and where deep change is underway',
};

const NATAL_POINT_MEANING = {
  Sun: 'your core identity and sense of purpose', Moon: 'your emotional world and instinctive needs',
  Mercury: 'your thinking and communication', Venus: 'your relationships and what you value',
  Mars: 'your drive and how you assert yourself', Jupiter: 'your sense of growth and opportunity',
  Saturn: 'your discipline and long-term structures', Uranus: 'your individuality and need for freedom',
  Neptune: 'your dreams, ideals and spiritual sensitivity', Pluto: 'your relationship with power and transformation',
  ASC: 'how you\u2019re showing up to the world right now',
};

const ASPECT_TEMPLATES = {
  Conjunction: (t, n, tm, nm) => `Transiting ${t} sits right on your natal ${n} \u2014 one of the more concentrated transits you can experience. ${t} governs ${tm}, and right now that is landing directly on ${nm}. Expect this theme to feel unusually present.`,
  Sextile:     (t, n, tm, nm) => `Transiting ${t} forms a supportive sextile to your natal ${n} \u2014 a gentle, low-pressure opening. ${t}'s themes of ${tm} can quietly support ${nm}, if you take the initiative to use it.`,
  Square:      (t, n, tm, nm) => `Transiting ${t} is squaring your natal ${n} \u2014 expect some friction here. ${t}'s themes of ${tm} are pushing up against ${nm} in a way that asks for adjustment rather than passive waiting.`,
  Trine:       (t, n, tm, nm) => `Transiting ${t} is trine your natal ${n} \u2014 an easy, flowing period. ${t}'s themes of ${tm} move naturally in support of ${nm}, with little resistance.`,
  Opposition:  (t, n, tm, nm) => `Transiting ${t} is opposing your natal ${n} \u2014 a moment of heightened awareness. ${t}'s themes of ${tm} pull against ${nm}, asking you to find balance between two real, competing needs.`,
};

function angleDiff(a, b) {
  let d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function getEclipticLongitude(bodyKey, date) {
  const vec = Astronomy.GeoVector(Astronomy.Body[bodyKey], date, true);
  const ecl = Astronomy.Ecliptic(vec);
  return ((ecl.elon % 360) + 360) % 360;
}

function calculateTransits(personName) {
  const natal = NATAL_DATA[personName];
  if (!natal) return null;

  const now = new Date();
  const currentPositions = {};
  const activeTransits = [];

  TRANSIT_BODIES.forEach(({ key, orb, label }) => {
    const lon = getEclipticLongitude(key, now);
    currentPositions[key] = lon;

    NATAL_POINTS.forEach(np => {
      const natalDeg = natal[np];
      if (natalDeg === undefined) return;
      const diff = angleDiff(lon, natalDeg);

      for (const aspect of ASPECTS) {
        const delta = Math.abs(diff - aspect.angle);
        if (delta <= orb) {
          activeTransits.push({
            transitPlanet: label,
            natalPoint: np === 'ASC' ? 'Ascendant' : np,
            aspect: aspect.name,
            symbol: aspect.symbol,
            quality: aspect.quality,
            orb: Math.round(delta * 100) / 100,
            text: ASPECT_TEMPLATES[aspect.name](
              label,
              np === 'ASC' ? 'Ascendant' : np,
              TRANSIT_PLANET_MEANING[key],
              NATAL_POINT_MEANING[np]
            ),
          });
          break;
        }
      }
    });
  });

  activeTransits.sort((a, b) => a.orb - b.orb);

  return { date: now, currentPositions, activeTransits };
}

function renderTransits(personName, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let result;
  try {
    result = calculateTransits(personName);
  } catch (e) {
    container.innerHTML = '<p style="color:var(--warm-gray);font-size:.85rem;">Transit calculation unavailable right now.</p>';
    return;
  }
  if (!result) return;

  const { date, currentPositions, activeTransits } = result;

  const dateStr = date.toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });

  // "Sky Right Now" strip
  let skyHtml = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:1px;background:var(--stone);border:1px solid var(--stone);margin-bottom:2.5rem;">';
  TRANSIT_BODIES.forEach(({ key, label }) => {
    const lon = currentPositions[key];
    const { sign, degree } = degToSign(lon);
    skyHtml += `
      <div style="background:var(--cream);padding:1.1rem;text-align:center;">
        <p style="font-size:.6rem;letter-spacing:.15em;text-transform:uppercase;color:var(--warm-gray);margin-bottom:.4rem">${label}</p>
        <p style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.05rem;color:var(--ink)">${sign}</p>
        <p style="font-size:.7rem;color:var(--warm-gray)">${degree}°</p>
      </div>`;
  });
  skyHtml += '</div>';

  // Active transits list
  let transitsHtml = '';
  if (activeTransits.length === 0) {
    transitsHtml = `<p style="font-size:1.05rem;color:var(--mid);line-height:1.8;">No major outer-planet transits are within a tight orb of your chart at this exact moment \u2014 check back in a week or two, as these shift gradually rather than daily.</p>`;
  } else {
    activeTransits.forEach(t => {
      const color = QUALITY_COLOR[t.quality] || '#888';
      transitsHtml += `
        <div style="border-left:3px solid ${color};padding-left:1.2rem;margin-bottom:1.75rem;">
          <div style="display:flex;align-items:center;gap:.65rem;margin-bottom:.4rem;flex-wrap:wrap;">
            <span style="font-size:1rem;color:${color}">${t.symbol}</span>
            <h3 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.05rem;font-weight:400;color:var(--ink)">Transiting ${t.transitPlanet} ${t.aspect} Natal ${t.natalPoint}</h3>
            <span style="font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;color:${color};margin-left:auto;white-space:nowrap">${t.quality} \u00b7 orb ${t.orb}\u00b0</span>
          </div>
          <p style="font-size:1rem;color:var(--mid);line-height:1.8">${t.text}</p>
        </div>`;
    });
  }

  container.innerHTML = `
    <p style="font-size:.8rem;color:var(--warm-gray);margin-bottom:2rem;">
      Calculated live in your browser for today \u2014 <strong style="color:var(--mid)">${dateStr}</strong>. This section recalculates itself every time the page loads, so it is always current. Only Sun, Mars, Jupiter, Saturn, Uranus, Neptune and Pluto are tracked \u2014 the Moon and inner planets move too quickly to produce a meaningful, lasting transit.
    </p>
    <h3 style="font-size:.7rem;letter-spacing:.2em;text-transform:uppercase;color:var(--warm-gray);margin-bottom:1rem;">The Sky Right Now</h3>
    ${skyHtml}
    <h3 style="font-size:.7rem;letter-spacing:.2em;text-transform:uppercase;color:var(--warm-gray);margin-bottom:1.5rem;">Active Transits to Your Chart</h3>
    ${transitsHtml}
  `;
}
