import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders modal chrome on document.body.
 *
 * `main.page-content` animates its opacity (`animation: fadeIn ... both` in index.css),
 * and an opacity animation creates a stacking context. An overlay rendered inside a page
 * is therefore trapped in it and `z-50` cannot escape, which caused two bugs that look
 * like styling problems but cannot be fixed with any colour/blur value:
 *
 *  1. The sidebar painted *over* the modal — `.nav-l` is a flex item with `z-index: 1`,
 *     and z-index applies to flex items even when `position: static`, so it sits in the
 *     root stacking context above the whole trapped subtree.
 *  2. `backdrop-filter` only samples its backdrop root, so the shell never blurred and
 *     page content rendered as crisp-text-plus-halo rather than frosted glass — worst on
 *     large bold headings, which resist blur far more than body text.
 *
 * Portalling to document.body puts the overlay back in the root stacking context.
 * React events still propagate through the React tree, so handlers are unaffected.
 */
export const ModalPortal = ({ children }: { children: ReactNode }) =>
  createPortal(children, document.body);
