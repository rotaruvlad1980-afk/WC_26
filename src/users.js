// ─── Default users ────────────────────────────────────────────────────────────
// Adminul poate modifica userii și parolele din panoul Admin → Utilizatori.
// Datele sunt salvate în localStorage, deci persistă între sesiuni.

export const DEFAULT_USERS = [
  { id: 'admin',  name: 'Admin',  password: 'admin123', isAdmin: true  },
  { id: 'vlad',   name: 'Vlad',   password: 'vlad123',  isAdmin: false },
  { id: 'tudor',  name: 'Tudor',  password: 'tudor123', isAdmin: false },
  { id: 'cristi', name: 'Cristi', password: 'cristi123',isAdmin: false },
  { id: 'andrei', name: 'Andrei', password: 'andrei123',isAdmin: false },
  { id: 'gabi',   name: 'Gabi',   password: 'gabi123',  isAdmin: false },
];
