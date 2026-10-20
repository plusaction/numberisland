/** `pnpm images:requests` → docs/IMAGE_REQUESTS.md (QUALITY96 §4.2 "이미지 주문서"). */
import { writeFileSync } from 'node:fs';

const PREFIX =
  'cute toy diorama style, soft clay and jelly materials, pastel colors (sand #ffe3b3, sea #6fd0e3, leaf #8bd48f, berry #ff8fab, sun #ffd166), thick rounded shapes, soft studio lighting, gentle shadows, dark purple outline (#3b3355), friendly and not scary, for children age 6-7, original character design,';
const BAN =
  'no text, no letters, no numbers, no watermark, no signature, no logo, no UI, no existing characters or brands, no weapons, no blood, no horror, no realistic humans';

const MONSTERS: [string, string, string][] = [
  ['donippo', '도니뽀', 'a round donut-shaped little bear with a sprinkle pattern'],
  ['ssokssok', '쏙쏙이', 'a stretchy striped sock creature with button eyes'],
  ['posongsong', '뽀송송', 'a fluffy mushroom creature with a spotted cap'],
  ['monggeul', '몽글몽글이', 'a puffy cloud creature with tiny rain-drop feet'],
  ['malangkung', '말랑쿵', 'a wobbly cube-shaped jelly creature'],
  ['pippitok', '삐삐톡', 'a small rounded toy robot with one antenna'],
  ['kungjjak', '쿵짝룡', 'a chubby baby dinosaur with tiny back bumps'],
  ['kwakpang', '꽥꽥팡', 'a duckling-like creature with a big round bill (not a real duck brand)'],
  ['kkomulang', '꼬물랑', 'a small octopus creature with curly arms'],
  ['banjjak', '반짝뿅', 'a shooting-star creature with a sparkly tail'],
  ['hobakjjing', '호박찡', 'a tiny pumpkin creature with a leaf hat'],
  ['gasikong', '가시콩', 'a soft round bean creature with gentle rounded spikes'],
  ['gogumarung', '고구마룽', 'a sweet-potato creature, long and lumpy'],
  ['cheesekong', '치즈콩콩', 'a cheese-wedge creature with round holes'],
  ['usanpong', '우산퐁', 'an umbrella creature that bounces on its handle'],
  ['jijik', '지직이', 'a zig-zag lightning creature, soft and round edges'],
  ['nunsongi', '눈송이뿌', 'a snowflake creature with six round arms'],
  ['bananyang', '바나냥', 'a banana-cat creature with cat ears'],
  ['pizzarang', '피자랑', 'a pizza-slice creature with pepperoni cheeks'],
  ['duduk', '두둑이', 'a mole creature with big soft paws and a flower on its head'],
];
const STAGES = ['bomb', 'zombie', 'fishing', 'slime', 'escape', 'pizza', 'cardbattle', 'race'];
const STAGE_DESC: Record<string, string> = {
  bomb: 'a toy bomb on a workbench with colourful striped wires',
  zombie: 'a cute wobbly sleepy zombie-like jelly friend in a garden yard (not scary)',
  fishing: 'a small round pond with friendly fish',
  slime: 'a jelly play tray with bouncy slimes',
  escape: 'a toy room with a big dial padlock on a door',
  pizza: 'a tiny pizza shop counter with an oven',
  cardbattle: 'a card table with big rounded cards',
  race: 'a roller-coaster race track with a little rocket cart',
};

type Row = [file: string, use: string, size: string, alpha: string, prompt: string];
const rows: Row[] = [];
for (const [id, ko, desc] of MONSTERS) {
  const stages = [
    'baby form',
    'grown form with a new accessory (horn, ears or hat)',
    'big final form, 25% larger, with a special glow',
  ];
  stages.forEach((s, i) => {
    rows.push([
      `monster_${id}_${i + 1}.webp`,
      `도감 카드 ${ko} ${i + 1}단계`,
      '1024×1024',
      '투명',
      `${PREFIX} ${desc}, ${s}, full body, centered, front 3/4 view`,
    ]);
  });
}
for (const s of STAGES)
  rows.push([
    `portal_${s}.webp`,
    `허브 포털 아이콘 (${s})`,
    '512×512',
    '투명',
    `${PREFIX} miniature icon of ${STAGE_DESC[s]}, isometric, centered`,
  ]);
for (const s of STAGES) {
  for (const theme of ['day', 'sunset', 'night']) {
    rows.push([
      `bg_${s}_${theme}.webp`,
      `스테이지 배경 (${s}, ${theme})`,
      '2048×1024',
      '불투명',
      `${PREFIX} wide soft background for ${STAGE_DESC[s]}, ${theme} lighting, very simple, blurred far distance`,
    ]);
  }
}
rows.push([
  'story_intro.webp',
  '세계관 인트로 컷',
  '2048×1024',
  '불투명',
  `${PREFIX} a round toy island with many small friendly monsters looking for lost glowing marbles`,
]);
rows.push([
  'brag_frame.webp',
  '자랑 카드 프레임',
  '1024×1024',
  '투명',
  `${PREFIX} a decorative rounded picture frame with stars and confetti, empty middle`,
]);
rows.push([
  'pwa_icon.png',
  'PWA 아이콘',
  '512×512',
  '불투명',
  `${PREFIX} app icon of a tiny round green island with a sun-yellow marble on top`,
]);

const md = [
  '# IMAGE_REQUESTS — 이미지 주문서',
  '',
  '> 자동 생성: `pnpm images:requests`. 이미지 생성 도구에 "생성 프롬프트" 칸을 그대로 붙여 넣고, 결과를 **파일명 그대로** `assets/inbox/`에 넣은 뒤 `pnpm images:ingest`를 실행하세요.',
  '> 이미지가 없는 동안 게임은 코드로 만든 3D/SVG 그림을 씁니다(레이아웃 고정 — 교체해도 깨지지 않음).',
  `> 모든 프롬프트 끝에 금지 요소를 붙이세요: \`${BAN}\``,
  '> 키링 40·아바타 아이템 60+·배지 24·섬 오브젝트 60 아이콘은 M7 데이터 확정 후 이 표에 추가됩니다.',
  '',
  '| # | 파일명 | 용도 | 크기 | 배경 | 생성 프롬프트 |',
  '|---|---|---|---|---|---|',
  ...rows.map((r, i) => `| ${i + 1} | \`${r[0]}\` | ${r[1]} | ${r[2]} | ${r[3]} | ${r[4]} |`),
  '',
].join('\n');
writeFileSync('docs/IMAGE_REQUESTS.md', md);
console.log(`docs/IMAGE_REQUESTS.md: ${rows.length} images`);
