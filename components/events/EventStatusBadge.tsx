type Status = 'draft' | 'pending_approval' | 'live' | 'rejected';

const CONFIG: Record<Status, {label: string; classes: string}> = {
  draft:            {label: 'Draft',            classes: 'bg-gray-100 text-gray-600'},
  pending_approval: {label: 'Pending approval', classes: 'bg-amber-100 text-amber-700'},
  live:             {label: 'Live',             classes: 'bg-green-100 text-green-700'},
  rejected:         {label: 'Rejected',         classes: 'bg-red-100 text-red-700'},
};

export default function EventStatusBadge({status}: {status: Status}) {
  const {label, classes} = CONFIG[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${classes}`}>
      {label}
    </span>
  );
}
