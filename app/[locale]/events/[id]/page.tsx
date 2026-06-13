import {Id} from '@/convex/_generated/dataModel';
import EventDetail from '@/components/events/EventDetail';

type Props = {params: {id: string}};

export default function EventDetailPage({params}: Props) {
  return <EventDetail eventId={params.id as Id<'events'>} />;
}
