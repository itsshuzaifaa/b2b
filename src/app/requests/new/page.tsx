import { redirect } from 'next/navigation';

export default function NewRequestPage() {
  redirect('/requests?create=true');
}
