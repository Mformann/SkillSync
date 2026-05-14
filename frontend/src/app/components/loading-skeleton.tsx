import { motion } from "motion/react";

export function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.4, 0.6, 0.4] }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            delay: i * 0.2,
          }}
          className="h-24 rounded-xl bg-muted"
        />
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: [0.4, 0.6, 0.4] }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
      }}
      className="rounded-xl border border-border bg-card p-6"
    >
      <div className="mb-4 h-12 w-12 rounded-lg bg-muted" />
      <div className="mb-2 h-4 w-2/3 rounded bg-muted" />
      <div className="h-8 w-1/2 rounded bg-muted" />
    </motion.div>
  );
}
