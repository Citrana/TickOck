import {Id} from '@/convex/_generated/dataModel';
import ManageDashboard from '@/components/events/manage/ManageDashboard';

type Props = {params: {id: string}};

export default function ManagePage({params}: Props) {
  return <ManageDashboard eventId={params.id as Id<'events'>} />;
}
