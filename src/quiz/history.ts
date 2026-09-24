/**
 * History questions, for the moment between lives.
 *
 * Multiple choice on purpose. The maths here is typed on a number pad because
 * an answer to a sum is a number; an answer about the Indus Valley is not, and
 * asking a nine-year-old to spell Mohenjo-daro on a phone keyboard while a
 * game is paused is a way of turning a good question into a chore.
 *
 * Every one has a line of explanation that runs whether the answer was right
 * or wrong, because the point is the thing being learned and not the mark.
 * Several are deliberately about the same few civilisations from different
 * angles — the second time the Indus Valley comes up it is not a new fact, it
 * is a fact you already have being asked to do something.
 *
 * `rating` is on the same Elo scale the maths uses, so the same machinery can
 * pitch a question at the person answering it rather than handing a
 * seven-year-old the Treaty of Versailles.
 */

export interface HistoryQuestion {
  id: string
  /** Elo-scale difficulty, matching the maths generators. */
  rating: number
  prompt: string
  /** The first one is the right answer; they are shuffled before they are shown. */
  options: [string, string, string] | [string, string, string, string]
  explain: string
}

export const HISTORY: readonly HistoryQuestion[] = [
  // --- the ancient world ---------------------------------------------------
  {
    id: 'pyramids',
    rating: 700,
    prompt: 'The Great Pyramid at Giza was built as a tomb for a king of which country?',
    options: ['Egypt', 'Greece', 'China', 'Peru'],
    explain: 'It was built about 4,500 years ago and stayed the tallest building on Earth for nearly 4,000 years.',
  },
  {
    id: 'indus-plumbing',
    rating: 900,
    prompt: 'The cities of the Indus Valley had something most cities would not have again for thousands of years. What?',
    options: ['Drains and covered sewers', 'Electric lights', 'Printed newspapers', 'Glass windows'],
    explain: 'Mohenjo-daro had brick drains under its streets and baths in ordinary houses, around 2500 BCE.',
  },
  {
    id: 'writing',
    rating: 850,
    prompt: 'What were the very first written records mostly about?',
    options: ['Counting goods and grain', 'Poems', 'Laws', 'Songs'],
    explain: 'Writing began as accounting. People invented it to keep track of who owed what, and stories came later.',
  },
  {
    id: 'mummy',
    rating: 750,
    prompt: 'Why did the ancient Egyptians make mummies?',
    options: [
      'They believed the body was needed in the afterlife',
      'To stop diseases spreading',
      'To make them lighter to carry',
      'Because the law said so',
    ],
    explain: 'They dried the body with salt and wrapped it in linen so its owner would still have it after death.',
  },
  {
    id: 'zero',
    rating: 1000,
    prompt: 'Zero as a number you can calculate with was first written down in which part of the world?',
    options: ['India', 'Rome', 'Egypt', 'Britain'],
    explain: 'Indian mathematicians used zero as a real number by the 600s. Roman numerals have no zero at all — try writing 101 in them.',
  },
  {
    id: 'great-wall',
    rating: 800,
    prompt: 'The Great Wall of China was mainly built to do what?',
    options: ['Keep armies out', 'Hold back a river', 'Mark a road', 'Carry water'],
    explain: 'It is not one wall but many, built and rebuilt over 2,000 years by different rulers.',
  },

  // --- how people worked things out ---------------------------------------
  {
    id: 'eratosthenes',
    rating: 1250,
    prompt: 'Over 2,000 years ago a Greek librarian measured the size of the whole Earth using what?',
    options: ['Shadows and a long walk', 'A telescope', 'A ship', 'A very long rope'],
    explain: 'Eratosthenes compared shadows in two cities at noon and got within a few per cent of the right answer.',
  },
  {
    id: 'printing',
    rating: 950,
    prompt: 'What did the printing press change most?',
    options: [
      'How many people could own a book',
      'How fast ships could sail',
      'How tall buildings could be',
      'How far letters could travel',
    ],
    explain: 'Before it, a book was copied by hand and cost as much as a house. After it, ideas spread faster than kings could stop them.',
  },
  {
    id: 'compass',
    rating: 900,
    prompt: 'The magnetic compass was first used for navigation by sailors from where?',
    options: ['China', 'Portugal', 'Egypt', 'Norway'],
    explain: 'Chinese sailors were using it by about 1100, a century or so before it reached Europe.',
  },
  {
    id: 'vaccine',
    rating: 1150,
    prompt: 'Smallpox is the only human disease ever wiped out completely. What did it?',
    options: ['Vaccination', 'Clean water', 'Antibiotics', 'Warmer houses'],
    explain: 'The last natural case was in 1977. It is the only time humans have removed a disease from the world entirely.',
  },
  {
    id: 'longitude',
    rating: 1300,
    prompt: 'For centuries sailors could not tell how far east or west they were. What finally solved it?',
    options: ['A clock accurate at sea', 'A better telescope', 'A bigger sail', 'A new kind of map'],
    explain: 'John Harrison spent decades building a clock that kept time on a rolling ship. Knowing the time at home tells you your longitude.',
  },

  // --- people ---------------------------------------------------------------
  {
    id: 'ashoka',
    rating: 1200,
    prompt: 'The emperor Ashoka is remembered for doing something unusual after winning a war. What?',
    options: [
      'He gave up war entirely',
      'He burned his own capital',
      'He gave the land back',
      'He crowned his enemy',
    ],
    explain: 'Sickened by the dead at Kalinga, he turned to Buddhism and had his new rules carved on pillars across India. Some still stand.',
  },
  {
    id: 'hypatia',
    rating: 1250,
    prompt: 'Hypatia of Alexandria was famous as which of these?',
    options: ['A mathematician and astronomer', 'A queen', 'A general', 'A ship builder'],
    explain: 'She taught mathematics and astronomy in Alexandria around 400 CE, when very few women were allowed to teach anything.',
  },
  {
    id: 'mansa-musa',
    rating: 1150,
    prompt: 'Mansa Musa of Mali is often called the richest person who ever lived. What was Mali rich in?',
    options: ['Gold', 'Iron', 'Silk', 'Coal'],
    explain: 'On his journey to Mecca in 1324 he gave away so much gold that its price stayed low in Egypt for years.',
  },
  {
    id: 'zheng-he',
    rating: 1200,
    prompt: "Zheng He's treasure fleet sailed from China in the 1400s. How did his ships compare to European ones of the time?",
    options: ['Far bigger', 'Much smaller', 'About the same', 'They had no sails'],
    explain: 'His largest ships may have been four times the length of Columbus’s. China then stopped the voyages and burned the records.',
  },
  {
    id: 'rosetta',
    rating: 1100,
    prompt: 'The Rosetta Stone was so useful because it had the same text written how?',
    options: ['In three scripts', 'In very large letters', 'On both sides', 'In gold'],
    explain: 'Greek could already be read, so it became the key that unlocked Egyptian hieroglyphs after 1,400 years of silence.',
  },

  // --- the world moving around ---------------------------------------------
  {
    id: 'silk-road',
    rating: 950,
    prompt: 'The Silk Road was not really a road. What was it?',
    options: [
      'A network of trade routes',
      'A single paved highway',
      'A river',
      'A wall',
    ],
    explain: 'Goods, ideas, religions and diseases all travelled it, usually changing hands many times on the way.',
  },
  {
    id: 'potato',
    rating: 1050,
    prompt: 'Potatoes, tomatoes and chocolate all came to Europe from where?',
    options: ['The Americas', 'India', 'China', 'Africa'],
    explain: 'None of them existed in Europe before the 1500s. Italian food without tomatoes is only a few hundred years old.',
  },
  {
    id: 'nile',
    rating: 800,
    prompt: 'Why did Egyptian farmers welcome the Nile flooding every year?',
    options: [
      'It left rich mud on the fields',
      'It washed the streets',
      'It cooled the air',
      'It brought fish to the doors',
    ],
    explain: 'The flood laid down fertile silt. Egyptians measured it carefully, because too little meant famine and too much meant ruin.',
  },
  {
    id: 'olympics',
    rating: 850,
    prompt: 'The ancient Olympic Games were held in honour of which Greek god?',
    options: ['Zeus', 'Apollo', 'Poseidon', 'Athena'],
    explain: 'They ran for about 1,200 years, and wars were paused so that people could travel to them safely.',
  },
  {
    id: 'plague-effect',
    rating: 1350,
    prompt: 'After the Black Death killed a huge share of Europe, what happened to the wages of the people left?',
    options: ['They went up', 'They went down', 'They stayed the same', 'They were banned'],
    explain: 'With far fewer workers, labour was suddenly worth more. Some rulers tried to make raising wages illegal, and failed.',
  },
  {
    id: 'library',
    rating: 1100,
    prompt: 'The Library of Alexandria tried to do something no library had tried before. What?',
    options: [
      'Collect every book in the world',
      'Lend books to anyone',
      'Print its own books',
      'Keep its books secret',
    ],
    explain: 'Ships arriving in the harbour had their books taken, copied, and the copy given back.',
  },

  // --- nearer the present ---------------------------------------------------
  {
    id: 'moon',
    rating: 900,
    prompt: 'In what decade did people first walk on the Moon?',
    options: ['The 1960s', 'The 1940s', 'The 1980s', 'The 2000s'],
    explain: 'July 1969. The computer that guided them had far less memory than the phone this game is running on.',
  },
  {
    id: 'flight',
    rating: 1000,
    prompt: 'How long was the first powered aeroplane flight in 1903?',
    options: ['About 12 seconds', 'About an hour', 'About a day', 'About 10 minutes'],
    explain: 'Twelve seconds and 120 feet. Sixty-six years later, people landed on the Moon.',
  },
  {
    id: 'penicillin',
    rating: 1150,
    prompt: 'Penicillin, the first antibiotic, was found by accident when a scientist noticed what?',
    options: [
      'Mould killing bacteria in a dish',
      'A dog that never got ill',
      'Bread that would not go stale',
      'A rusty nail that healed',
    ],
    explain: 'Alexander Fleming came back from holiday to a contaminated dish in 1928. He nearly threw it away.',
  },
  {
    id: 'computer',
    rating: 1300,
    prompt: 'Who wrote what is often called the first computer program, and for a machine that was never built?',
    options: ['Ada Lovelace', 'Charles Babbage', 'Alan Turing', 'Grace Hopper'],
    explain: 'In the 1840s she worked out how Babbage’s Analytical Engine could compute a sequence of numbers, a century before any computer ran.',
  },
  {
    id: 'salt-march',
    rating: 1250,
    prompt: 'In 1930 Gandhi walked 240 miles to the sea to do what?',
    options: ['Make salt', 'Catch a ship', 'Meet a king', 'Visit a temple'],
    explain: 'Making your own salt was illegal under British rule. Breaking that one small law on purpose brought millions into the protest.',
  },
  {
    id: 'berlin-wall',
    rating: 1200,
    prompt: 'The Berlin Wall divided a city for 28 years. What happened in 1989?',
    options: ['People opened it and pulled it down', 'It was made taller', 'It was moved', 'It burned'],
    explain: 'A muddled announcement on television sent crowds to the checkpoints, and the guards, with no orders, let them through.',
  },
  {
    id: 'internet',
    rating: 1350,
    prompt: 'The internet was first built so that what could keep working?',
    options: [
      'Messages, even if part of the network was destroyed',
      'Television broadcasts',
      'Telephone calls across the sea',
      'Weather forecasts',
    ],
    explain: 'It splits everything into small packets that find their own way, so there is no single wire to cut.',
  },
  {
    id: 'lighthouse',
    rating: 1050,
    prompt: 'How did people record what happened before writing was invented?',
    options: [
      'They memorised it and told it aloud',
      'They did not, it was all lost',
      'They drew maps',
      'They carved it in gold',
    ],
    explain: 'Spoken history can last thousands of years. Some Aboriginal Australian stories describe coastlines that the sea covered 7,000 years ago.',
  },
]

/** A question near a rating, avoiding anything asked lately. */
export function historyAt(
  rating: number,
  roll: number,
  recent: readonly string[] = [],
): HistoryQuestion {
  const fresh = HISTORY.filter((q) => !recent.includes(q.id))
  const pool = fresh.length > 0 ? fresh : HISTORY
  // The five nearest in difficulty, then one of those at random — near enough
  // to be pitched right, loose enough that it is not the same one every time.
  const near = [...pool].sort((a, b) => Math.abs(a.rating - rating) - Math.abs(b.rating - rating))
  const window = near.slice(0, Math.min(5, near.length))
  return window[Math.floor(roll * window.length) % window.length]
}
