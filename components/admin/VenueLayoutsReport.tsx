'use client';

import {useState} from 'react';
import {useQuery} from 'convex/react';
import {useTranslations} from 'next-intl';
import {api} from '@/convex/_generated/api';
import {Link} from '@/lib/navigation';
import DataTable, {ColumnDef} from '@/components/ui/DataTable';

type Row = NonNullable<ReturnType<typeof useQuery<typeof api.adminReports.listAllVenueLayouts>>>[number];
type StatusFilter = 'all' | 'draft' | 'published';

const STATUS_BADGE: Record<Row['status'], string> = {
  draft: 'bg-gray-100 text-gray-600',
  published: 'bg-green-100 text-green-800',
};

export default function VenueLayoutsReport() {
  const t = useTranslations('admin.venueLayoutsReport');
  const tPagination = useTranslations('ui.pagination');
  const data = useQuery(api.adminReports.listAllVenueLayouts);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  if (data === undefined) {
    return <p className="py-12 text-center text-sm text-gray-400">{t('loading')}</p>;
  }

  const filtered = statusFilter === 'all' ? data : data.filter(row => row.status === statusFilter);

  const columns: ColumnDef<Row>[] = [
    {
      key: 'name',
      header: t('cols.name'),
      render: row => <p className="font-medium text-gray-900">{row.name}</p>,
    },
    {
      key: 'owner',
      header: t('cols.owner'),
      render: row => <span className="text-gray-600">{row.ownerName ?? t('unknownOwner')}</span>,
    },
    {
      key: 'status',
      header: t('cols.status'),
      render: row => (
        <span
          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[row.status]}`}
        >
          {t(`status.${row.status}`)}
        </span>
      ),
    },
    {
      key: 'sectionCount',
      header: t('cols.sectionCount'),
      render: row => <span className="text-gray-600">{row.sectionCount}</span>,
    },
    {
      key: 'updatedAt',
      header: t('cols.updatedAt'),
      headerClassName: 'text-right',
      cellClassName: 'text-right text-xs text-gray-400',
      render: row =>
        new Date(row.updatedAt).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(['all', 'draft', 'published'] as const).map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`rounded-full px-3.5 py-1 text-xs font-medium transition-colors ${
              statusFilter === status
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t(`statusFilter.${status}`)}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        getRowKey={row => row._id}
        emptyMessage={t('empty')}
        searchPlaceholder={t('searchPlaceholder')}
        searchFilter={(row, q) =>
          row.name.toLowerCase().includes(q) || (row.ownerName?.toLowerCase().includes(q) ?? false)
        }
        previousLabel={tPagination('previous')}
        nextLabel={tPagination('next')}
        formatResults={(from, to, total) => tPagination('results', {from, to, total})}
        renderActions={row => (
          <Link
            href={`/events/venue-layouts/${row._id}`}
            className="text-xs font-medium text-gray-600 underline underline-offset-2 hover:text-gray-900"
          >
            {t('manage')}
          </Link>
        )}
      />
    </div>
  );
}
