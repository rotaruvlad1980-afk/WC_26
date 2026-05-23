[README.md](https://github.com/user-attachments/files/28182576/README.md)
# ⚽ CM 2026 – Campionat Amical de Pariuri

Aplicație web pentru pariuri amicale pe Campionatul Mondial de Fotbal 2026.

---

## 🚀 Deploy pe Vercel (pas cu pas)

### 1. Creează cont GitHub (dacă nu ai)
→ https://github.com/signup

### 2. Creează repository nou
1. Mergi la https://github.com/new
2. Nume: `cm2026-pariuri`
3. Lasă-l **Public** (necesar pentru Vercel gratuit)
4. Click **Create repository**

### 3. Încarcă fișierele
Pe pagina repo-ului nou creat, click **"uploading an existing file"**:
- Trage toate fișierele din acest folder (`worldcup2026/`) în browser
- **Atenție:** trebuie să păstrezi structura de foldere:
  ```
  index.html
  vite.config.js
  package.json
  public/
    ball.svg
  src/
    main.jsx
    App.jsx
    storage.js
    scoring.js
    openfootball.js
    users.js
  ```
- Click **Commit changes**

### 4. Deploy pe Vercel
1. Mergi la https://vercel.com/signup
2. Conectează-te cu GitHub
3. Click **"Add New Project"** → selectează `cm2026-pariuri`
4. Vercel detectează automat că e Vite → click **Deploy**
5. În ~2 minute primești un link de forma: `cm2026-pariuri.vercel.app`

**Trimite link-ul prietenilor — gata!** 🎉

---

## 👥 Utilizatori impliciti

| Username | Parolă      | Rol     |
|----------|-------------|---------|
| admin    | admin123    | Admin   |
| vlad     | vlad123     | Jucător |
| tudor    | tudor123    | Jucător |
| cristi   | cristi123   | Jucător |
| andrei   | andrei123   | Jucător |
| gabi     | gabi123     | Jucător |

**⚠️ Important:** Schimbă parolele imediat după primul login!
- Jucătorii își pot schimba parola din **Profil → Schimbă parola**
- Adminul poate schimba parola oricui din **Admin → Utilizatori**

---

## ✏️ Cum schimbi jucătorii (admin)

1. Loghează-te cu `admin`
2. Mergi la **⚙️ Admin → Utilizatori**
3. Poți:
   - **Edita** un jucător (nume, parolă, rol)
   - **Adăuga** un jucător nou
   - **Șterge** un jucător

Modificările sunt salvate automat în browser-ul fiecărui utilizator.

**⚠️ Limitare importantă:** Datele sunt stocate în `localStorage` al browser-ului.
Asta înseamnă că toți jucătorii trebuie să acceseze **același link**,
dar fiecare vede propriile sale pariuri. Datele nu se sincronizează
între dispozitive diferite — pariurile puse pe telefon nu apar pe laptop.

---

## 📖 Sistem de punctaj

| Situație | Puncte |
|----------|--------|
| Scor exact ghicit (ex: 2-1 = 2-1) | **+3 pts** |
| Rezultat corect, scor diferit | **+1 pt** |
| Per finalista ghicită corect | **+1 pt** |
| Ambele finaliste ghicite | **+3 pts** |
| Meci nepariat (limita 30 min) | **−1 pt** |

**Departajare:** Mai multe scoruri exacte. Egalitate perfectă → se împart banii.

---

## 🔄 Actualizare rezultate

Rezultatele se preiau automat de la:
`https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json`

- Sincronizare automată la fiecare deschidere (dacă au trecut >30 min)
- Buton manual **"🔄 Actualizează"** disponibil oricând
- Adminul poate corecta manual orice scor din **Admin → Rezultate**

---

## 🛠️ Rulează local (opțional)

```bash
npm install
npm run dev
# → http://localhost:5173
```

---

## ⚠️ Note importante

1. **Datele sunt în localStorage** — dacă dai Clear la browser history, datele dispar
2. **Toți jucătorii trebuie să folosească același browser/dispozitiv** pentru pariuri sau să acceseze link-ul Vercel (recomandat)
3. **Parolele nu sunt criptate** — e un joc amical, nu o bancă 😄
4. **Finalistele** trebuie alese înainte de 11 Iunie 2026

---

Mult succes și distracție! ⚽🏆
