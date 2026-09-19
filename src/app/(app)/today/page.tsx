import { redirect } from 'next/navigation';

/**
 * Today folded into Plan: the capacity number and the week it sits in were
 * never two decisions. Kept as a redirect so older links still land somewhere.
 */
export default function TodayPage() {
  redirect('/plan');
}
