# Tiflisi — Digital Menu (QR)

რეპოზიტორია: [github.com/tiflisiqr-droid/QR](https://github.com/tiflisiqr-droid/QR)

React + Vite SPA: სტუმრის მენიუ და ადმინ პანელი (`/admin`).

## ცოცხალი საიტი (GitHub Pages)

როცა **Actions** წარმატებით დაასრულებს დეპლოის შემდეგ:

| | URL |
|---|-----|
| მენიუ | [https://tiflisiqr-droid.github.io/QR/](https://tiflisiqr-droid.github.io/QR/) |
| ადმინი | [https://tiflisiqr-droid.github.io/QR/admin](https://tiflisiqr-droid.github.io/QR/admin) |

ბილდში `base` ავტომატურია: **`/QR/`** (`GITHUB_REPOSITORY` → სახელი `QR`).

## პირველად GitHub-ზე (Pages)

1. **Actions** უნდა იყოს ჩართული რეპოზიტორიაში (Settings → Actions → General).
2. `main`-ზე `push` შემდეგ გაეშვება **Deploy to GitHub Pages** — ააგებს `dist`-ს და ატვირთავს ბრენჩ **`gh-pages`**-ზე.
3. **Settings → Pages → Build and deployment:**
   - **Source:** „Deploy from a branch“
   - **Branch:** `gh-pages` / **folder:** `/ (root)`  
   (არა `main` და არა წყარო `index.html` რეპოს ფესვიდან — იქ `/src/main.jsx`ა და საიტი თეთრი რჩება.)

თუ ადრე იყო არჩეული „GitHub Actions“ წყაროდ და ცარიელი იყო არტეფაქტი, გადართე **`gh-pages`** ბრენჩზე.

`dist/` `main`-ზე არ იტვირთება — CI თვითონ აგებს და აგზავნის `gh-pages`-ზე.

## ლოკალურად

```bash
npm install
npm run dev
```

ლოკალური dev პორტი: **3001**. URL-ები: `http://localhost:3001/` და `http://localhost:3001/admin`.

## ფაილები

| ფაილი | დანიშნულება |
|--------|-------------|
| `.github/workflows/deploy-github-pages.yml` | GitHub Pages დეპლოი |
| `scripts/ensure-spa-404.mjs` | `dist/404.html` = `index.html` (განახლება `/admin`-ზე) |
| `vite.config.js` | `base` — CI-ზე `/QR/`, ლოკალურად `/` |

საკუთარ დომენზე root `/`-ზე დასაყენებლად workflow-ში `npm run build`-ს დაამატე `VITE_BASE_PATH: /` (და გაითვალისწინე, რომ GitHub project URL-სთან asset paths შეიძლება დაგჭირდეს ცალკე ჰოსტინგი).
