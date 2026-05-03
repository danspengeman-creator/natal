# Spengeman Natal Charts

Static HTML site — no build step, no dependencies, no server required.
All CSS and JS is inlined directly into each page.

## File Structure

```
index.html        ← Landing page
dan.html          ← Dan's chart
lillian.html      ← Lillian's chart
nolan.html        ← Nolan's chart
maybelle.html     ← Maybelle's chart
README.md
```

## Push to GitHub Pages

```bash
git init
git add .
git commit -m "Initial natal chart site"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

Then: GitHub repo → Settings → Pages → Source: Deploy from branch → main / (root) → Save.

Your site will be live at: https://YOUR_USERNAME.github.io/YOUR_REPO/

## Updating a Chart

Open the relevant `.html` file. All content is plain HTML — find the section you want to edit and change it directly. No build step needed — just save and push.
