import { AnimatePresence, motion } from 'framer-motion';
import { getStatsMove } from '@lib/utils';
import { formatNumber } from '@lib/date';

type NumberStatsProps = {
  move: number;
  stats: number;
  alwaysShowStats?: boolean;
};

export function NumberStats({
  move,
  stats,
  alwaysShowStats
}: NumberStatsProps): JSX.Element {
  return (
    <span className='inline-block overflow-hidden align-middle'>
      <AnimatePresence mode='wait' initial={false}>
        {(alwaysShowStats || !!stats) && (
          <motion.span
            className='inline-block text-sm'
            {...getStatsMove(move)}
            key={stats}
          >
            {formatNumber(stats)}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
