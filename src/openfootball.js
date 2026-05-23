// ─── Openfootball integration ─────────────────────────────────────────────────

const URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';

const NAME_MAP = {
  'Mexico':'Mexic','South Africa':'Africa de Sud','South Korea':'Coreea de Sud',
  'Czech Republic':'Cehia','Canada':'Canada','Bosnia & Herzegovina':'Bosnia',
  'Qatar':'Qatar','Switzerland':'Elvetia','Brazil':'Brazilia','Morocco':'Maroc',
  'Haiti':'Haiti','Scotland':'Scotia','USA':'SUA','United States':'SUA',
  'Paraguay':'Paraguay','Australia':'Australia','Turkey':'Turcia','Germany':'Germania',
  'Curaçao':'Curacao','Ivory Coast':'Coasta de Fildes','Ecuador':'Ecuador',
  'Netherlands':'Olanda','Japan':'Japonia','Sweden':'Suedia','Tunisia':'Tunisia',
  'Belgium':'Belgia','Egypt':'Egipt','Iran':'Iran','New Zealand':'Noua Zeelanda',
  'Spain':'Spania','Cape Verde':'Capul Verde','Saudi Arabia':'Arabia Saudita',
  'Uruguay':'Uruguay','France':'Franta','Senegal':'Senegal','Iraq':'Irak',
  'Norway':'Norvegia','Argentina':'Argentina','Algeria':'Algeria','Austria':'Austria',
  'Jordan':'Iordania','Portugal':'Portugalia','DR Congo':'Congo RD',
  'Uzbekistan':'Uzbekistan','Colombia':'Columbia','England':'Anglia',
  'Croatia':'Croatia','Ghana':'Ghana','Panama':'Panama','Serbia':'Serbia',
  'Poland':'Polonia','Denmark':'Danemarca','Nigeria':'Nigeria','Chile':'Chile',
  'Peru':'Peru','Venezuela':'Venezuela','Bolivia':'Bolivia','Honduras':'Honduras',
  'Jamaica':'Jamaica','Costa Rica':'Costa Rica','El Salvador':'El Salvador',
  'Cameroon':'Camerun','Mali':'Mali','Romania':'Romania','Hungary':'Ungaria',
  'Slovakia':'Slovacia','Slovenia':'Slovenia','North Macedonia':'Macedonia de Nord',
  'Albania':'Albania','Kosovo':'Kosovo','Montenegro':'Muntenegru',
  'Bosnia and Herzegovina':'Bosnia','Ireland':'Irlanda','Wales':'Tara Galilor',
  'Finland':'Finlanda','Iceland':'Islanda','Estonia':'Estonia',
  'Latvia':'Letonia','Lithuania':'Lituania','Italy':'Italia','Greece':'Grecia',
  'Israel':'Israel','Ukraine':'Ucraina','Georgia':'Georgia','Armenia':'Armenia',
  'Azerbaijan':'Azerbaidjan','Kazakhstan':'Kazahstan','Uzbekistan':'Uzbekistan',
  'Tajikistan':'Tadjikistan','China PR':'China','India':'India',
  'Indonesia':'Indonezia','Vietnam':'Vietnam','Thailand':'Tailanda',
  'Philippines':'Filipine','Malaysia':'Malaysia',
  'Fiji':'Fiji','Papua New Guinea':'Papua Noua Guinee',
  'Solomon Islands':'Insulele Solomon','New Caledonia':'Noua Caledonie',
};

function ro(name) { return NAME_MAP[name] || name; }

function parseRound(round, group) {
  if (group) return `Grupa ${group}`;
  const r = round.toLowerCase();
  if (r.includes('third')) return 'Finala Mică';
  if (r.includes('final')) return 'FINALA';
  if (r.includes('semi')) return 'Semifinale';
  if (r.includes('quarter')) return 'Sferturi';
  if (r.includes('round of 16')) return 'Optimi';
  if (r.includes('round of 32')) return '16-imi';
  return round;
}

function parseMatchDate(date, time) {
  // time format: "13:00 UTC-6" or "20:00 UTC+1"
  const timeStr = (time || '00:00').split(' ')[0];
  const offsetMatch = (time || '').match(/UTC([+-]\d+)/);
  const offsetH = offsetMatch ? parseInt(offsetMatch[1]) : 0;
  const base = new Date(`${date}T${timeStr}:00`);
  return new Date(base.getTime() - offsetH * 3600000).toISOString();
}

export async function fetchMatches() {
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data?.matches) throw new Error('Format invalid');

  return data.matches.map((m, idx) => {
    const group = m.group ? m.group.replace('Group ', '') : null;
    const score = m.score?.ft?.length === 2
      ? { home: String(m.score.ft[0]), away: String(m.score.ft[1]) }
      : null;

    return {
      id: idx + 1,
      home: ro(m.team1),
      away: ro(m.team2),
      date: parseMatchDate(m.date, m.time),
      group,
      round: parseRound(m.round || '', group),
      score, // null = not played yet
    };
  });
}
