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

## პირველად GitHub-ზე

1. ამ პროექტის ფაილები ატვირთე ამ რეპოში (ან `git clone` შემდეგ `git push`).
2. **Settings → Pages → Build and deployment → Source:** აირჩიე **GitHub Actions** (არა „Deploy from branch“).
3. **Actions** ჩანართში ნახე workflow **Deploy to GitHub Pages** — პირველი `push` `main` / `master`-ზე უნდა გაეშვას.

`dist/` არ იტვირთება — CI აგებს `npm ci` + `npm run build` (მათ შორის `404.html` SPA-სთვის).

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
