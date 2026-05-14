import React from 'react';
import { createReactBlockSpec } from '@blocknote/react';
import { useNavigate } from 'react-router-dom';
import { FileText, ArrowRight } from 'lucide-react';
import { usePagesContext } from '@/contexts/PagesContext';
import { renderIcon } from '@/lib/iconRegistry';

function PageLinkInner({ block }) {
  const pages = usePagesContext();
  const navigate = useNavigate();
  const page = pages.find((p) => p.id === block.props.pageId);

  if (!page) {
    return (
      <div
        className="my-1 flex items-center gap-2 rounded-lg border border-dashed border-[#3a3a3a] px-3 py-2 text-sm text-[#6e6e6e]"
        contentEditable={false}
      >
        <FileText className="h-4 w-4 flex-shrink-0" />
        <span>Page not found</span>
      </div>
    );
  }

  return (
    <div
      className="group my-1 flex cursor-pointer items-center gap-2.5 rounded-lg border border-[#2a2a2a] bg-[#202020] px-3 py-2.5 transition-colors hover:border-[#3a3a3a] hover:bg-[#272727]"
      contentEditable={false}
      onClick={() => navigate(`/page/${page.id}`)}
    >
      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center text-base leading-none">
        {page.icon ? renderIcon(page.icon) : <FileText className="h-4 w-4 text-[#6e6e6e]" />}
      </span>
      <span className="flex-1 text-sm font-medium text-[#e8e8e8]">
        {page.title || 'Untitled'}
      </span>
      <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-[#6e6e6e] transition-transform group-hover:translate-x-0.5" />
    </div>
  );
}

export const PageLinkBlock = createReactBlockSpec(
  {
    type: 'pagelink',
    propSchema: { pageId: { default: '' } },
    content: 'none',
  },
  {
    render: ({ block }) => <PageLinkInner block={block} />,
  }
);
