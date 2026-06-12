import {redirect} from 'next/navigation';

// Fallback for the root path — middleware handles locale detection,
// but this ensures a redirect if middleware is bypassed.
export default function RootPage() {
  redirect('/en');
}
