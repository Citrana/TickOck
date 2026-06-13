'use client';

import {useState} from 'react';
import {useQuery, useMutation} from 'convex/react';
import {api} from '@/convex/_generated/api';
import {type Id} from '@/convex/_generated/dataModel';
import {useTranslations} from 'next-intl';
import FormField from '@/components/ui/FormField';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import {describeConditions, describeFee, type PricingRule} from '@/lib/platformFee';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'XOF', 'MAD'];

type RuleForm = {
  label: string;
  ticketPriceMin: string;
  ticketPriceMax: string;
  totalTicketsMin: string;
  totalTicketsMax: string;
  feeType: 'percentage' | 'flat_per_ticket';
  feeValue: string;
  currency: string;
};

const EMPTY_FORM: RuleForm = {
  label: '',
  ticketPriceMin: '',
  ticketPriceMax: '',
  totalTicketsMin: '',
  totalTicketsMax: '',
  feeType: 'percentage',
  feeValue: '',
  currency: 'USD',
};

function parseOptionalNumber(v: string): number | undefined {
  const n = parseFloat(v);
  return v.trim() === '' || isNaN(n) ? undefined : n;
}

export default function PricingManager() {
  const t = useTranslations('admin.pricing');
  const rules = useQuery(api.platformPricing.listAll);
  const createRule = useMutation(api.platformPricing.createRule);
  const toggleRule = useMutation(api.platformPricing.toggleRule);
  const removeRule = useMutation(api.platformPricing.removeRule);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<RuleForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [toggling, setToggling] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  function patch(update: Partial<RuleForm>) {
    setForm(prev => ({...prev, ...update}));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!form.label.trim()) return setFormError(t('validation.labelRequired'));
    const feeValue = parseFloat(form.feeValue);
    if (isNaN(feeValue) || feeValue < 0) return setFormError(t('validation.feeInvalid'));
    if (form.feeType === 'percentage' && feeValue > 100)
      return setFormError(t('validation.percentageTooHigh'));

    setSaving(true);
    try {
      await createRule({
        label: form.label.trim(),
        ticketPriceMin: parseOptionalNumber(form.ticketPriceMin),
        ticketPriceMax: parseOptionalNumber(form.ticketPriceMax),
        totalTicketsMin: parseOptionalNumber(form.totalTicketsMin),
        totalTicketsMax: parseOptionalNumber(form.totalTicketsMax),
        feeType: form.feeType,
        feeValue,
        currency: form.currency,
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('validation.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(rule: PricingRule) {
    setToggling(rule._id);
    try {
      await toggleRule({ruleId: rule._id as Id<'platformPricingRules'>, isActive: !rule.isActive});
    } finally {
      setToggling(null);
    }
  }

  async function handleRemove(ruleId: string) {
    setRemoving(ruleId);
    try {
      await removeRule({ruleId: ruleId as Id<'platformPricingRules'>});
      setConfirmDelete(null);
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* How rules work */}
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
        <p className="font-medium">{t('howItWorksTitle')}</p>
        <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-blue-700">
          <li>{t('howItWorks1')}</li>
          <li>{t('howItWorks2')}</li>
          <li>{t('howItWorks3')}</li>
        </ul>
      </div>

      {/* Rule list */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{t('rulesTitle')}</h2>
            <p className="text-xs text-gray-500">{t('rulesSubtitle')}</p>
          </div>
          <button
            onClick={() => {
              setShowForm(v => !v);
              setForm(EMPTY_FORM);
              setFormError('');
            }}
            className="btn-ticket inline-flex items-center gap-1.5 bg-gray-900 px-4 py-2 text-sm font-semibold text-white"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            {t('addButton')}
          </button>
        </div>

        {/* Add form */}
        {showForm && (
          <form onSubmit={handleCreate} className="border-b border-gray-100 bg-gray-50 p-5">
            <p className="mb-4 text-sm font-medium text-gray-700">{t('formTitle')}</p>
            <div className="space-y-4">
              <FormField label={t('fields.label')} required>
                <Input
                  value={form.label}
                  onChange={e => patch({label: e.target.value})}
                  placeholder={t('labelPlaceholder')}
                />
              </FormField>

              {/* Conditions */}
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  {t('conditionsTitle')}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label={t('fields.ticketPriceMin')}>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.ticketPriceMin}
                      onChange={e => patch({ticketPriceMin: e.target.value})}
                      placeholder={t('optionalPlaceholder')}
                    />
                  </FormField>
                  <FormField label={t('fields.ticketPriceMax')}>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.ticketPriceMax}
                      onChange={e => patch({ticketPriceMax: e.target.value})}
                      placeholder={t('optionalPlaceholder')}
                    />
                  </FormField>
                  <FormField label={t('fields.totalTicketsMin')}>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={form.totalTicketsMin}
                      onChange={e => patch({totalTicketsMin: e.target.value})}
                      placeholder={t('optionalPlaceholder')}
                    />
                  </FormField>
                  <FormField label={t('fields.totalTicketsMax')}>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={form.totalTicketsMax}
                      onChange={e => patch({totalTicketsMax: e.target.value})}
                      placeholder={t('optionalPlaceholder')}
                    />
                  </FormField>
                </div>
                <p className="mt-2 text-xs text-gray-400">{t('conditionsHint')}</p>
              </div>

              {/* Fee */}
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  {t('feeTitle')}
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <FormField label={t('fields.feeType')} required>
                    <Select
                      value={form.feeType}
                      onChange={e =>
                        patch({feeType: e.target.value as 'percentage' | 'flat_per_ticket'})
                      }
                    >
                      <option value="percentage">{t('feeTypes.percentage')}</option>
                      <option value="flat_per_ticket">{t('feeTypes.flatPerTicket')}</option>
                    </Select>
                  </FormField>
                  <FormField label={t('fields.feeValue')} required>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.feeValue}
                      onChange={e => patch({feeValue: e.target.value})}
                      placeholder={form.feeType === 'percentage' ? '2.5' : '0.50'}
                    />
                  </FormField>
                  <FormField label={t('fields.currency')} required>
                    <Select value={form.currency} onChange={e => patch({currency: e.target.value})}>
                      {CURRENCIES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </Select>
                  </FormField>
                </div>
              </div>

              {formError && (
                <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">{formError}</p>
              )}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-ticket inline-flex items-center gap-2 bg-gray-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {saving ? t('saving') : t('saveButton')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {t('cancel')}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Rules list */}
        {rules === undefined ? (
          <div className="flex items-center gap-2 px-5 py-8 text-sm text-gray-400">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
            {t('loading')}
          </div>
        ) : rules.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-500">
            {t('noRules')}
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {rules.map((rule, index) => (
              <li key={rule._id} className="flex items-start gap-4 px-5 py-4">
                {/* Priority badge */}
                <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-500">
                  {index + 1}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{rule.label}</span>
                    {rule.isActive ? (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                        {t('statusActive')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                        {t('statusInactive')}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {describeConditions(rule)}
                  </p>
                  <p className="text-xs font-medium text-rose-600">
                    {t('fee')}: {describeFee(rule)}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleToggle(rule)}
                    disabled={toggling === rule._id}
                    title={rule.isActive ? t('deactivate') : t('activate')}
                    className="rounded-lg border border-gray-200 bg-white p-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {rule.isActive ? (
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                        <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.064 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                      </svg>
                    )}
                  </button>

                  {confirmDelete === rule._id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleRemove(rule._id)}
                        disabled={removing === rule._id}
                        className="rounded-lg bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
                      >
                        {removing === rule._id ? '…' : t('confirmDelete')}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                      >
                        {t('cancel')}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(rule._id)}
                      title={t('delete')}
                      className="rounded-lg border border-gray-200 bg-white p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
