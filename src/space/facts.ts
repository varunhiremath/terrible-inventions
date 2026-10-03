/**
 * Did you know.
 *
 * The maths question used to be what happened when you lost a shield, and the
 * verdict on it was plain: not in this game. So a knock puts up one of these
 * instead — a true thing about the sky you are flying through — and the game
 * carries on. Nothing is asked and nothing has to be answered, which is the
 * whole point: the reward for reading it is that it is interesting.
 *
 * Every one of them is real. Where a number is quoted it is the number
 * astronomers use, rounded to something a nine-year-old can hold: 2,000 km/h
 * rather than 2,100, eight minutes rather than 8.317. Nothing here is a
 * rounding that changes the fact.
 *
 * They are kept apart from `level.ts` because those eight are the arrival
 * cards — one per world, earned by getting there — and these are the ones that
 * turn up when things go wrong. Different jobs, different lists.
 */

export interface Fact {
  /** What it is about, so the card can say so. */
  about: string
  text: string
}

export const FACTS: readonly Fact[] = [
  { about: 'the Sun', text: 'Light from the Sun takes about eight minutes to reach us. If the Sun went out, we would carry on seeing it for another eight minutes.' },
  { about: 'the Sun', text: 'The Sun is about 99.8% of all the mass in the solar system. Everything else — all eight planets, every moon, every asteroid — is the last 0.2%.' },
  { about: 'Mercury', text: 'Mercury has almost no air, so its sky is black even in the middle of the day.' },
  { about: 'Mercury', text: 'Mercury is not the hottest planet, even though it is the closest to the Sun. Venus is, because Venus has a blanket and Mercury has none.' },
  { about: 'Venus', text: 'A day on Venus is longer than a year on Venus. It takes 243 Earth days to turn round once and only 225 to go round the Sun.' },
  { about: 'Venus', text: 'The air on Venus presses down as hard as being a kilometre under the sea on Earth.' },
  { about: 'Earth', text: 'Earth is the only planet not named after a god. The other seven are all Roman gods.' },
  { about: 'Earth', text: 'You are travelling at about 30 kilometres a second right now, because that is how fast Earth goes round the Sun.' },
  { about: 'the Moon', text: 'The Moon always shows us the same side. It turns exactly once for every trip round us, so the far side was not seen by anyone until a spacecraft went and looked in 1959.' },
  { about: 'the Moon', text: 'Footprints on the Moon will still be there in a million years. There is no wind and no rain to wipe them away.' },
  { about: 'Mars', text: 'Sunsets on Mars are blue. The dust in its air scatters light the opposite way round to ours.' },
  { about: 'Mars', text: 'Mars has about a third of Earth’s gravity, so a jump that gets you half a metre here would get you a metre and a half there.' },
  { about: 'Mars', text: 'Phobos, the bigger of Mars’s two moons, goes round so fast that it rises in the west and sets in the east — twice a day.' },
  { about: 'the asteroids', text: 'The asteroid belt sounds crowded and is not. If you flew through it you would be lucky to see one, because they are usually hundreds of thousands of kilometres apart.' },
  { about: 'Jupiter', text: 'Jupiter’s Great Red Spot is a storm wider than the Earth, and it has been blowing for at least 190 years.' },
  { about: 'Jupiter', text: 'Jupiter has the shortest day of any planet: it turns round in under ten hours, which is why it bulges at the middle.' },
  { about: 'Europa', text: 'Europa, one of Jupiter’s moons, has an ocean of liquid water under its ice — probably more water than every ocean on Earth put together.' },
  { about: 'Io', text: 'Io, another of Jupiter’s moons, is the most volcanic place in the solar system. Jupiter squeezes it as it orbits, and the squeezing melts the inside.' },
  { about: 'Saturn', text: 'Saturn is less dense than water. If you could find a bath big enough, it would float.' },
  { about: 'Saturn', text: 'Saturn’s rings are enormous across and very thin — mostly about ten metres thick, which is nothing at all next to 280,000 kilometres wide.' },
  { about: 'Titan', text: 'Titan, Saturn’s biggest moon, has rivers and lakes — but of liquid methane, because at −180°C water is rock.' },
  { about: 'Uranus', text: 'Uranus was the first planet found with a telescope, in 1781. The six before it had been known for as long as anyone had been looking up.' },
  { about: 'Uranus', text: 'Because Uranus lies on its side, each of its poles gets 42 years of daylight and then 42 years of night.' },
  { about: 'Neptune', text: 'Neptune was found with maths before anyone saw it. Uranus was not moving quite right, so astronomers worked out where the thing pulling on it must be, pointed a telescope there, and it was.' },
  { about: 'Neptune', text: 'One year on Neptune is 165 Earth years. It has gone round the Sun once since it was discovered.' },
  { about: 'Pluto', text: 'Pluto is smaller than our Moon. It is also sometimes closer to the Sun than Neptune is, because its orbit cuts inside.' },
  { about: 'comets', text: 'A comet’s tail always points away from the Sun, whichever way the comet is travelling — so on the way out, it goes tail first.' },
  { about: 'space', text: 'There is no sound in space. Sound needs air to travel through, and there is almost none out there.' },
  { about: 'space', text: 'Space is not far away. It starts about 100 kilometres up, which is less than an hour’s drive — if you could drive straight up.' },
  { about: 'space', text: 'The nearest star after the Sun is Proxima Centauri, and its light takes just over four years to get here.' },
  { about: 'space', text: 'Astronauts get slightly taller in orbit — a few centimetres — because without gravity squashing them their spine stretches out.' },
  { about: 'space', text: 'Voyager 1 left in 1977 and is now the furthest away anything we have built has ever been. It is still sending back readings.' },
  { about: 'space', text: 'A spacesuit is not just clothing. It is a tiny spacecraft with air, water, heating, cooling and a radio, and it costs about as much as a house.' },
  { about: 'space', text: 'The International Space Station goes round the Earth every 90 minutes, so the crew see sixteen sunrises a day.' },
  { about: 'gravity', text: 'Everything in orbit is falling. It is just moving sideways fast enough that it keeps missing the ground.' },
  { about: 'the stars', text: 'When you look at a star you are looking into the past. Some of the ones you can see tonight left their light before anyone alive was born.' },

  // --- past Neptune ---------------------------------------------------------
  //
  // The game used to stop at the eighth planet, so these are new. Same rule as
  // all of the above: every one is real, and where there is a number it is the
  // number astronomers use, rounded to something a nine-year-old can hold.
  { about: 'the Kuiper Belt', text: 'Pluto was called the ninth planet for 76 years. It was renamed a dwarf planet in 2006, once it turned out there were thousands of others out there like it.' },
  { about: 'the Kuiper Belt', text: 'A spacecraft called New Horizons flew past Pluto in 2015 at 50,000 km/h. It had been travelling for nine and a half years and got about twenty minutes of close-up pictures.' },
  { about: 'the Oort Cloud', text: 'The Oort Cloud is a shell of frozen comets wrapped right round the solar system. Nobody has ever seen it; we know it is there because of where the comets come from.' },
  { about: 'the Oort Cloud', text: 'Voyager 1 has been flying since 1977 and will not reach the Oort Cloud for another 300 years. It will not be out the other side for 30,000.' },
  { about: 'comets', text: 'A comet’s tail always points away from the Sun, not backwards along its path — so on the way out, a comet flies tail first.' },
  { about: 'Proxima Centauri', text: 'Proxima Centauri is the nearest star to us and you cannot see it without a telescope. It is a red dwarf: small, dim, and it will still be burning long after the Sun has gone out.' },
  { about: 'Proxima Centauri', text: 'There is a planet going round Proxima Centauri, about the size of Earth. Its year is eleven days long.' },
  { about: 'Sirius', text: 'Sirius looks white to us and is really two stars. The small one is a burnt-out core the size of Earth, and a teaspoon of it would weigh about a tonne.' },
  { about: 'Sirius', text: 'The ancient Egyptians used Sirius as a calendar: when it first appeared before dawn, the Nile was about to flood.' },
  { about: 'Betelgeuse', text: 'Betelgeuse is the red one in Orion’s shoulder. It is so big that light takes an hour to cross it, where it takes four and a half seconds to cross the Sun.' },
  { about: 'Betelgeuse', text: 'Betelgeuse will explode as a supernova one day. It may already have done it — the light takes 650 years to get here, so we would not know yet.' },
  { about: 'the Crab Nebula', text: 'What is left in the middle of the Crab Nebula is a star so squashed that it is 20 km across and spins thirty times a second.' },
  { about: 'nebulas', text: 'A nebula is where stars are made. Gravity pulls a cloud of gas together for millions of years until the middle gets hot enough to catch light.' },
  { about: 'Sagittarius A*', text: 'There is a black hole at the middle of our galaxy and everything in the Milky Way, including us, is going round it. One trip takes the Sun 230 million years.' },
  { about: 'black holes', text: 'A black hole is not a hole. It is a lump of stuff so heavy that nothing moving through space is fast enough to climb away from it — and nothing in the universe is faster than light.' },
  { about: 'black holes', text: 'The first photograph of a black hole was taken in 2019, using eight telescopes all over the Earth working as one.' },
  { about: 'Andromeda', text: 'Andromeda is the furthest thing you can see without a telescope. It is two and a half million light years away, so you are seeing it as it was before there were people.' },
  { about: 'galaxies', text: 'There are more galaxies in the universe than there are grains of sand on every beach on Earth, and each one holds billions of stars.' },
  { about: 'the Milky Way', text: 'The Milky Way is the galaxy we live in, seen from the inside. That faint band across a really dark sky is its far side.' },
]

/**
 * One that has not just been read.
 *
 * Takes the ones already seen so a run does not hand out the same fact twice
 * before it has run through the rest. When they have all been seen the list
 * starts again, which after thirty-six knocks is fair enough.
 */
export function pickFact(seen: readonly string[], roll: number): Fact {
  const fresh = FACTS.filter((f) => !seen.includes(f.text))
  const pool = fresh.length > 0 ? fresh : FACTS
  return pool[Math.min(pool.length - 1, Math.floor(roll * pool.length))]
}
