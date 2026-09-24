/**
 * Number puzzles.
 *
 * Separate from the generated maths, and for a different job. The generators
 * make an endless supply of practice at a chosen difficulty, which is what you
 * want for getting fluent. These are the other thing: one idea each, the kind
 * where knowing it is worth more than being quick at it. Most of them can be
 * worked out from scratch by somebody who has never met the idea before, which
 * is the test a question has to pass to be in here.
 *
 * Primes, fractions, algebra, sequences and series, because those are the ones
 * he likes.
 */
import type { Ask } from '../types'

export const MATHS: readonly Ask[] = [
  // --- primes --------------------------------------------------------------
  {
    id: 'm-prime-which',
    topic: 'maths',
    rating: 700,
    prompt: 'Which of these numbers is prime?',
    options: ['17', '21', '27', '33'],
    explain: '17 has no factors but 1 and itself. 21 is 3×7, 27 is 3×9, and 33 is 3×11.',
  },
  {
    id: 'm-prime-even',
    topic: 'maths',
    rating: 850,
    prompt: 'How many even prime numbers are there?',
    options: ['One', 'None', 'Two', 'Infinitely many'],
    explain: 'Just 2. Every other even number can be divided by 2, which gives it a third factor.',
  },
  {
    id: 'm-prime-one',
    topic: 'maths',
    rating: 900,
    prompt: 'Why is 1 not counted as a prime number?',
    options: [
      'It has only one factor, not two',
      'It is too small',
      'It is odd',
      'It is a square number',
    ],
    explain: 'A prime has exactly two factors: 1 and itself. For 1 those are the same number, so it only has one.',
  },
  {
    id: 'm-prime-count-20',
    topic: 'maths',
    rating: 950,
    prompt: 'How many prime numbers are there below 20?',
    options: ['8', '7', '9', '10'],
    explain: '2, 3, 5, 7, 11, 13, 17, 19 — eight of them.',
  },
  {
    id: 'm-prime-twin',
    topic: 'maths',
    rating: 1050,
    prompt: 'Twin primes are primes two apart, like 11 and 13. Which of these pairs is a twin prime pair?',
    options: ['29 and 31', '23 and 25', '33 and 35', '49 and 51'],
    explain: 'Both 29 and 31 are prime. 25 is 5×5, 33 is 3×11, 35 is 5×7, 49 is 7×7 and 51 is 3×17.',
  },
  {
    id: 'm-prime-infinite',
    topic: 'maths',
    rating: 1250,
    prompt: 'Are there a largest prime number and then no more after it?',
    options: [
      'No — the primes never run out',
      'Yes, and we have found it',
      'Yes, but nobody has found it',
      'Nobody can ever know',
    ],
    explain:
      'Euclid proved it over 2,000 years ago. Multiply any list of primes together and add 1: the result has a prime factor that is not on your list.',
  },
  {
    id: 'm-prime-factor',
    topic: 'maths',
    rating: 1000,
    prompt: 'What do you get if you write 60 as a product of prime numbers?',
    options: ['2 × 2 × 3 × 5', '2 × 3 × 10', '4 × 15', '6 × 10'],
    explain: 'Every whole number breaks into primes in exactly one way. For 60 it is 2×2×3×5.',
  },
  {
    id: 'm-prime-sieve',
    topic: 'maths',
    rating: 1150,
    prompt: 'To check whether 97 is prime, what is the largest number you actually need to test as a divisor?',
    options: ['9', '48', '96', '10'],
    explain:
      'You only need to go up to the square root, about 9.8. If a factor were bigger than that, its partner would be smaller, and you would have found it already.',
  },

  // --- fractions -----------------------------------------------------------
  {
    id: 'm-frac-bigger',
    topic: 'maths',
    rating: 750,
    prompt: 'Which is bigger: 3/4 or 2/3?',
    options: ['3/4', '2/3', 'They are equal', 'It depends'],
    explain: 'Over twelfths: 3/4 is 9/12 and 2/3 is 8/12. So 3/4 wins by one twelfth.',
  },
  {
    id: 'm-frac-add',
    topic: 'maths',
    rating: 850,
    prompt: 'What is 1/2 + 1/3?',
    options: ['5/6', '2/5', '1/5', '2/6'],
    explain: 'Make the bottoms match: 3/6 + 2/6 = 5/6. You cannot add the tops and bottoms separately.',
  },
  {
    id: 'm-frac-divide',
    topic: 'maths',
    rating: 1050,
    prompt: 'What is 1/2 ÷ 1/4?',
    options: ['2', '1/8', '1/2', '4'],
    explain: 'It is asking how many quarters fit into a half. Two. Dividing by a fraction flips it and multiplies.',
  },
  {
    id: 'm-frac-of',
    topic: 'maths',
    rating: 900,
    prompt: 'What is 2/3 of 45?',
    options: ['30', '15', '22', '67'],
    explain: 'A third of 45 is 15, so two thirds is 30.',
  },
  {
    id: 'm-frac-between',
    topic: 'maths',
    rating: 1100,
    prompt: 'How many fractions are there between 1/3 and 1/2?',
    options: ['Infinitely many', 'None', 'One', 'Six'],
    explain:
      'Take the average of any two and you get one in between. Do it again on the new pair, and again — it never stops.',
  },
  {
    id: 'm-frac-decimal',
    topic: 'maths',
    rating: 950,
    prompt: 'What is 1/8 as a decimal?',
    options: ['0.125', '0.18', '0.8', '0.08'],
    explain: 'Half of 1/4, which is 0.25. Halve it and you get 0.125.',
  },
  {
    id: 'm-frac-third',
    topic: 'maths',
    rating: 1000,
    prompt: 'Why does 1/3 written as a decimal go on forever?',
    options: [
      'Because 3 does not divide into a power of 10',
      'Because 3 is an odd number',
      'Because 3 is prime',
      'Because we use the wrong symbols',
    ],
    explain:
      'Decimals are tenths, hundredths, thousandths. 3 never divides exactly into any of those, so the division never finishes. In base 3, one third is just 0.1.',
  },
  {
    id: 'm-frac-simplify',
    topic: 'maths',
    rating: 800,
    prompt: 'Which fraction is the same as 12/18?',
    options: ['2/3', '3/4', '1/2', '6/8'],
    explain: 'Both divide by 6: 12/18 becomes 2/3.',
  },

  // --- algebra -------------------------------------------------------------
  {
    id: 'm-alg-solve',
    topic: 'maths',
    rating: 800,
    prompt: 'If 3x + 4 = 19, what is x?',
    options: ['5', '7', '4', '6'],
    explain: 'Take 4 off both sides: 3x = 15. Divide both sides by 3: x = 5.',
  },
  {
    id: 'm-alg-both-sides',
    topic: 'maths',
    rating: 1000,
    prompt: 'If 5x − 2 = 3x + 8, what is x?',
    options: ['5', '3', '4', '10'],
    explain: 'Take 3x off both sides: 2x − 2 = 8. Add 2: 2x = 10. So x = 5.',
  },
  {
    id: 'm-alg-expand',
    topic: 'maths',
    rating: 1100,
    prompt: 'What is 4(x + 3) written out without brackets?',
    options: ['4x + 12', '4x + 3', 'x + 12', '4x + 7'],
    explain: 'Everything inside gets multiplied: 4 times x, and 4 times 3.',
  },
  {
    id: 'm-alg-word',
    topic: 'maths',
    rating: 950,
    prompt: 'I think of a number, double it, and add 7. I get 23. What was the number?',
    options: ['8', '15', '9', '16'],
    explain: 'Work backwards: take off 7 to get 16, then halve it. As algebra, 2n + 7 = 23.',
  },
  {
    id: 'm-alg-square',
    topic: 'maths',
    rating: 1250,
    prompt: 'What is (x + 1)(x + 2) multiplied out?',
    options: ['x² + 3x + 2', 'x² + 2', 'x² + 3x', '2x + 3'],
    explain: 'Every term in the first bracket meets every term in the second: x², 2x, x and 2.',
  },
  {
    id: 'm-alg-negative',
    topic: 'maths',
    rating: 1150,
    prompt: 'If −2x = 10, what is x?',
    options: ['−5', '5', '−20', '8'],
    explain: 'Divide both sides by −2. A negative divided by a negative is positive, so −10 ÷ −2 would be 5, but here it is 10 ÷ −2 = −5.',
  },
  {
    id: 'm-alg-substitute',
    topic: 'maths',
    rating: 900,
    prompt: 'If a = 3 and b = 5, what is 2a + b?',
    options: ['11', '13', '16', '10'],
    explain: '2 lots of 3 is 6, plus 5 makes 11.',
  },
  {
    id: 'm-alg-why-letters',
    topic: 'maths',
    rating: 1200,
    prompt: 'In algebra, what is a letter like x actually standing for?',
    options: [
      'A number we do not know yet',
      'Any letter of the alphabet',
      'A secret code',
      'Always the number 10',
    ],
    explain:
      'It is a placeholder for a number. That is the whole trick: you can do arithmetic with a number before you know what it is.',
  },

  // --- sequences -----------------------------------------------------------
  {
    id: 'm-seq-arith',
    topic: 'maths',
    rating: 700,
    prompt: 'What comes next? 4, 9, 14, 19, ...',
    options: ['24', '23', '25', '21'],
    explain: 'It goes up by 5 every time.',
  },
  {
    id: 'm-seq-square',
    topic: 'maths',
    rating: 850,
    prompt: 'What comes next? 1, 4, 9, 16, 25, ...',
    options: ['36', '30', '35', '49'],
    explain: 'They are the square numbers: 1×1, 2×2, 3×3, and so on. Next is 6×6.',
  },
  {
    id: 'm-seq-fib',
    topic: 'maths',
    rating: 950,
    prompt: 'What comes next? 1, 1, 2, 3, 5, 8, 13, ...',
    options: ['21', '18', '20', '26'],
    explain: 'Each number is the two before it added together. 8 + 13 = 21. This is the Fibonacci sequence.',
  },
  {
    id: 'm-seq-double',
    topic: 'maths',
    rating: 800,
    prompt: 'What comes next? 3, 6, 12, 24, ...',
    options: ['48', '36', '30', '42'],
    explain: 'It doubles each time. Sequences that multiply grow far faster than ones that add.',
  },
  {
    id: 'm-seq-triangle',
    topic: 'maths',
    rating: 1050,
    prompt: 'What comes next? 1, 3, 6, 10, 15, ...',
    options: ['21', '20', '18', '25'],
    explain:
      'The triangular numbers: add 2, then 3, then 4, then 5. They are how many dots fit in a triangle.',
  },
  {
    id: 'm-seq-differences',
    topic: 'maths',
    rating: 1200,
    prompt: 'What comes next? 2, 5, 10, 17, 26, ...',
    options: ['37', '35', '36', '38'],
    explain: 'The gaps are 3, 5, 7, 9 — so the next gap is 11. It is also just the square numbers plus 1.',
  },
  {
    id: 'm-seq-alternate',
    topic: 'maths',
    rating: 1100,
    prompt: 'What comes next? 1, −2, 4, −8, 16, ...',
    options: ['−32', '32', '−24', '24'],
    explain: 'Multiply by −2 each time. The sign flips every step because the multiplier is negative.',
  },
  {
    id: 'm-seq-primes',
    topic: 'maths',
    rating: 1000,
    prompt: 'What comes next? 2, 3, 5, 7, 11, 13, ...',
    options: ['17', '15', '16', '19'],
    explain: 'The primes. 15 is 3×5 so it is skipped, and 17 is next.',
  },

  // --- series --------------------------------------------------------------
  {
    id: 'm-ser-first-100',
    topic: 'maths',
    rating: 1150,
    prompt: 'What do you get if you add up every whole number from 1 to 100?',
    options: ['5050', '4950', '5500', '10000'],
    explain:
      'Pair them: 1 + 100, 2 + 99, 3 + 98. Fifty pairs, each making 101. 50 × 101 = 5050. Gauss is said to have done this in his head as a schoolboy.',
  },
  {
    id: 'm-ser-halves',
    topic: 'maths',
    rating: 1300,
    prompt: 'What does 1/2 + 1/4 + 1/8 + 1/16 + ... get closer and closer to, if you never stop?',
    options: ['1', '2', 'Infinity', '1/2'],
    explain:
      'Each step closes half the remaining gap to 1, so it gets as close to 1 as you like and never passes it.',
  },
  {
    id: 'm-ser-odd',
    topic: 'maths',
    rating: 1200,
    prompt: 'Add up the odd numbers: 1, then 1+3, then 1+3+5. What kind of number do you always get?',
    options: ['A square number', 'A prime number', 'An even number', 'A triangular number'],
    explain: '1, 4, 9, 16, 25. Adding the first n odd numbers always gives n×n.',
  },
  {
    id: 'm-ser-arith-sum',
    topic: 'maths',
    rating: 1050,
    prompt: 'What is 2 + 4 + 6 + 8 + 10 + 12?',
    options: ['42', '40', '36', '44'],
    explain: 'It is double 1+2+3+4+5+6, which is 21. So 42.',
  },
  {
    id: 'm-ser-doubling',
    topic: 'maths',
    rating: 1350,
    prompt: 'A grain of rice on square 1 of a chessboard, 2 on square 2, 4 on square 3, doubling each time. Roughly how much is on the last square alone?',
    options: [
      'More than the whole world grows in a year',
      'About a sackful',
      'About a lorry load',
      'About a roomful',
    ],
    explain:
      'The 64th square holds 2⁶³ grains — around 9 billion billion. Doubling is the fastest ordinary growth there is.',
  },

  // --- shape and the rest of it --------------------------------------------
  {
    id: 'm-zero',
    topic: 'maths',
    rating: 1100,
    prompt: 'Why can you not divide a number by zero?',
    options: [
      'No number times zero gives you back what you started with',
      'Because zero is not a real number',
      'Because the answer is always zero',
      'You can, and the answer is infinity',
    ],
    explain:
      '6 ÷ 2 = 3 because 3 × 2 = 6. For 6 ÷ 0 you need something that times 0 makes 6, and nothing does.',
  },
  {
    id: 'm-pi',
    topic: 'maths',
    rating: 900,
    prompt: 'What does π measure?',
    options: [
      'How many times a circle’s width fits round its edge',
      'The area of a circle',
      'The radius of a circle',
      'How round something is',
    ],
    explain: 'Take any circle at all, divide the distance round by the distance across, and you get π — about 3.14159.',
  },
  {
    id: 'm-angles',
    topic: 'maths',
    rating: 800,
    prompt: 'What do the three angles inside any triangle always add up to?',
    options: ['180°', '360°', '90°', 'It depends on the triangle'],
    explain: 'Always 180°, for every flat triangle, however stretched. Tear the corners off a paper one and they make a straight line.',
  },
  {
    id: 'm-powers',
    topic: 'maths',
    rating: 1000,
    prompt: 'What is 2⁵?',
    options: ['32', '10', '25', '16'],
    explain: 'Five 2s multiplied: 2×2×2×2×2. It means multiply, not add.',
  },
  {
    id: 'm-roman',
    topic: 'maths',
    rating: 1150,
    prompt: 'What is the main reason it is hard to do long multiplication with Roman numerals?',
    options: [
      'There is no place value and no zero',
      'The letters are hard to write',
      'They only go up to 1000',
      'They have no odd numbers',
    ],
    explain:
      'In 407 the 4 means four hundreds because of where it sits. Roman numerals have no such column, so there is nothing to carry into.',
  },
  {
    id: 'm-binary',
    topic: 'maths',
    rating: 1200,
    prompt: 'In binary, what number is 1011?',
    options: ['11', '1011', '7', '13'],
    explain: 'The columns are 8, 4, 2, 1. So 8 + 0 + 2 + 1 = 11.',
  },
  {
    id: 'm-average',
    topic: 'maths',
    rating: 950,
    prompt: 'Five numbers have a mean of 10. Four of them are 6, 8, 12 and 14. What is the fifth?',
    options: ['10', '8', '12', '9'],
    explain: 'The five must total 50. The four given make 40, so the last is 10.',
  },
  {
    id: 'm-probability',
    topic: 'maths',
    rating: 1250,
    prompt: 'You flip a fair coin and get heads four times in a row. What are the chances the next flip is heads?',
    options: ['One in two', 'Less than one in two', 'More than one in two', 'Almost none'],
    explain:
      'The coin has no memory. Each flip is one in two no matter what came before. Expecting it to "even out" is called the gambler’s fallacy.',
  },
]
