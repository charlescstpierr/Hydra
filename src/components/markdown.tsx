'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-hydra text-[15px] break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: (props) => <a {...props} target="_blank" rel="noreferrer" />,
          img: (props) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              {...props}
              alt={props.alt ?? ''}
              className="my-2 max-h-[420px] rounded-xl border border-[var(--border)]"
            />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
