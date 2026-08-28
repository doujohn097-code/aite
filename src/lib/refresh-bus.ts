type RefreshHandler = () => void | Promise<void>;

const handlers = new Set<RefreshHandler>();

export function registerPageRefresh(handler: RefreshHandler): () => void {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

export async function runPageRefresh(): Promise<void> {
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document
      .querySelectorAll<HTMLElement>('[data-scroll-root]')
      .forEach((node) => {
        node.scrollTop = 0;
      });
  }

  if (!handlers.size) {
    await new Promise((resolve) => window.setTimeout(resolve, 420));
    return;
  }

  await Promise.allSettled(
    Array.from(handlers).map((handler) => Promise.resolve(handler()))
  );
}
