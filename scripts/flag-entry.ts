import { FLAGS } from '../src/quiz/flags'
import { drawFlag } from '../src/quiz/drawFlag'
;(window as unknown as { FLAGS: unknown; drawFlag: unknown }).FLAGS = FLAGS
;(window as unknown as { FLAGS: unknown; drawFlag: unknown }).drawFlag = drawFlag
