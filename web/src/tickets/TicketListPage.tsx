import {
  Button,
  Field,
  makeStyles,
  mergeClasses,
  MessageBar,
  MessageBarBody,
  SearchBox,
  Select,
  shorthands,
  Skeleton,
  SkeletonItem,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  tokens,
} from '@fluentui/react-components'
import { Add20Regular, Dismiss12Regular, Search24Regular } from '@fluentui/react-icons'
import { useEffect, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { useApplications, useLookups, useTicketCounts, useTicketList, useUsers } from '../api/queries'
import type { TicketListItemDto, TicketListParams, TicketSort } from '../api/types'
import { PageHeader } from '../components/PageHeader'
import { usePageStyles } from '../components/pageStyles'
import { usePageTitle } from '../components/usePageTitle'
import { relativeTime } from '../utils/format'
import { priorities, priorityLabel, severities, ticketTypes } from './labels'
import { describeSort, hasFilters, nextSort, PAGE_SIZE, readListParams, views, writeListParams } from './listParams'
import { PersonLabel, PriorityTag, SeverityLabel, StatusBadge, TypeIcon } from './TicketBits'

const useStyles = makeStyles({
  tabs: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '2px',
    minHeight: '44px',
    margin: '-4px 0 16px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  tab: {
    minHeight: '42px',
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    padding: '8px 16px',
    border: 'none',
    borderBottom: '2px solid transparent',
    background: 'transparent',
    color: tokens.colorNeutralForeground3,
    fontFamily: 'inherit',
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    cursor: 'pointer',
    ':hover': { color: tokens.colorNeutralForeground1, backgroundColor: 'rgba(255,255,255,.6)' },
  },
  tabActive: {
    color: tokens.colorBrandForeground1,
    ...shorthands.borderBottom('2px', 'solid', tokens.colorBrandStroke1),
    ':hover': { color: tokens.colorBrandForeground1 },
  },
  tabCount: {
    minWidth: '21px',
    height: '21px',
    padding: '0 5px',
    display: 'inline-grid',
    placeItems: 'center',
    borderRadius: '11px',
    backgroundColor: '#e8e8e8',
    color: tokens.colorNeutralForeground2,
    fontSize: '11px',
  },
  tabCountActive: { backgroundColor: '#d8e9f8', color: tokens.colorBrandForeground2 },
  filters: { padding: '16px', marginBottom: '16px' },
  filterRow: {
    display: 'grid',
    gridTemplateColumns: '1.25fr repeat(6, minmax(110px, .8fr))',
    gap: '10px',
    alignItems: 'end',
    '@media (max-width: 1150px)': { gridTemplateColumns: 'repeat(4, 1fr)' },
  },
  searchCell: { minWidth: 0, '@media (max-width: 1150px)': { gridColumn: 'span 2' } },
  search: { width: '100%', maxWidth: 'none' },
  fieldLabel: { fontSize: tokens.fontSizeBase200, fontWeight: tokens.fontWeightSemibold },
  activeFilters: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '7px',
    marginTop: '13px',
    paddingTop: '12px',
    borderTop: `1px solid ${tokens.colorNeutralStroke3}`,
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '4px 8px',
    border: 'none',
    borderRadius: '12px',
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
    fontFamily: 'inherit',
    fontSize: tokens.fontSizeBase200,
    cursor: 'pointer',
    ':hover': { backgroundColor: tokens.colorBrandBackground2Hover },
  },
  clear: { marginLeft: 'auto' },
  results: { overflow: 'hidden' },
  resultsHead: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  muted: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
  tableWrap: { width: '100%', overflowX: 'auto' },
  // Fluent tables split the width evenly; size columns to their content instead so titles get the room.
  table: { minWidth: '1000px', tableLayout: 'auto' },
  filterField: { minWidth: 0 },
  filterSelect: { minWidth: 0, width: '100%' },
  refreshing: { opacity: 0.6, transition: 'opacity .15s' },
  headerCell: {
    backgroundColor: '#fafafa',
    color: tokens.colorNeutralForeground3,
    fontWeight: tokens.fontWeightSemibold,
    whiteSpace: 'nowrap',
  },
  row: {
    cursor: 'pointer',
    ':hover': { backgroundColor: '#f8fbfe' },
    ':focus-visible': { outline: `2px solid ${tokens.colorBrandStroke1}`, outlineOffset: '-2px' },
  },
  number: { color: tokens.colorBrandForeground1, fontWeight: tokens.fontWeightBold, textDecoration: 'none' },
  title: { minWidth: '245px', fontWeight: tokens.fontWeightSemibold },
  nowrap: { whiteSpace: 'nowrap' },
  pagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '13px 16px',
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  pages: { display: 'flex', gap: '4px' },
  empty: {
    display: 'grid',
    justifyItems: 'center',
    gap: '8px',
    padding: '70px 20px',
    textAlign: 'center',
  },
  emptyIcon: {
    width: '52px',
    height: '52px',
    display: 'grid',
    placeItems: 'center',
    borderRadius: '50%',
    backgroundColor: '#f0f0f0',
    color: tokens.colorNeutralForeground3,
  },
  skeletonRow: { display: 'grid', gridTemplateColumns: '.5fr 1.8fr 1fr .8fr .8fr', gap: '24px', padding: '14px 16px' },
})

const columns: { label: string; sort?: TicketSort }[] = [
  { label: 'Ticket #', sort: 'number' },
  { label: 'Type' },
  { label: 'Title', sort: 'title' },
  { label: 'Application', sort: 'application' },
  { label: 'Severity', sort: 'severity' },
  { label: 'Priority', sort: 'priority' },
  { label: 'Status', sort: 'status' },
  { label: 'Assignee', sort: 'assignee' },
  { label: 'Last updated', sort: 'updated' },
]

export function TicketListPage() {
  const page = usePageStyles()
  const styles = useStyles()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const params = readListParams(searchParams)
  usePageTitle(params.search ? `“${params.search}” · Tickets` : 'All Tickets')

  const list = useTicketList(params)
  const counts = useTicketCounts()
  const lookups = useLookups()
  const applications = useApplications()
  const developers = useUsers('developer')

  /** Applies changes to the URL. Any change other than paging goes back to page 1. */
  const update = (changes: Partial<TicketListParams>, replace = false) => {
    const next = { ...params, page: 1, ...changes }
    setSearchParams(writeListParams(next), { replace })
  }
  const clearFilters = () => setSearchParams(writeListParams({ view: params.view, pageSize: PAGE_SIZE }))

  // The search box updates the URL as the user pauses typing; the header search can also set it.
  const [searchText, setSearchText] = useState(params.search ?? '')
  const [lastUrlSearch, setLastUrlSearch] = useState(params.search)
  if (params.search !== lastUrlSearch) {
    setLastUrlSearch(params.search)
    setSearchText(params.search ?? '')
  }
  useEffect(() => {
    const term = searchText.trim() || undefined
    if (term === params.search) return
    const timer = setTimeout(() => update({ search: term }, true), 350)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the typed text should restart the timer
  }, [searchText])

  const statuses = [...(lookups.data?.statuses ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)
  const statusName = statuses.find((s) => s.id === params.statusId)?.name
  const appName = applications.data?.find((a) => a.id === params.applicationId)?.name
  const assigneeName = developers.data?.find((u) => u.id === params.assigneeId)?.displayName

  const open = (ticket: TicketListItemDto) =>
    void navigate(`/tickets/${ticket.number}`, { state: { listSearch: location.search } })
  const onRowClick = (e: MouseEvent, ticket: TicketListItemDto) => {
    if ((e.target as HTMLElement).closest('a')) return // the ticket-number link navigates itself
    open(ticket)
  }
  const onRowKey = (e: KeyboardEvent, ticket: TicketListItemDto) => {
    if (e.key === 'Enter' && e.target === e.currentTarget) open(ticket)
  }

  const data = list.data
  const totalPages = data ? Math.max(1, Math.ceil(data.totalCount / data.pageSize)) : 1
  const first = data && data.totalCount > 0 ? (data.page - 1) * data.pageSize + 1 : 0
  const last = data ? Math.min(data.page * data.pageSize, data.totalCount) : 0

  return (
    <div className={page.page}>
      <PageHeader
        breadcrumb="Tickets / All Tickets"
        title="All Tickets"
        description="Track defects and enhancements across ISSD applications."
        action={
          <Button appearance="primary" icon={<Add20Regular />} onClick={() => void navigate('/tickets/new')}>
            New Ticket
          </Button>
        }
      />

      <div className={styles.tabs} role="tablist" aria-label="Ticket quick views">
        {views.map((v) => {
          const active = params.view === v.value
          return (
            <button
              key={v.value}
              role="tab"
              aria-selected={active}
              className={mergeClasses(styles.tab, active && styles.tabActive)}
              onClick={() => update({ view: v.value })}
            >
              {v.label}
              {counts.data && (
                <span className={mergeClasses(styles.tabCount, active && styles.tabCountActive)}>
                  {counts.data[v.countKey]}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <section className={mergeClasses(page.panel, styles.filters)} aria-label="Filters">
        <div className={styles.filterRow}>
          <div className={styles.searchCell}>
            <SearchBox
              className={styles.search}
              placeholder="Search tickets"
              aria-label="Search tickets"
              value={searchText}
              onChange={(_, d) => setSearchText(d.value)}
            />
          </div>
          <FilterSelect
            label="Type"
            value={params.type}
            empty="All types"
            options={ticketTypes}
            onChange={(v) => update({ type: v as TicketListParams['type'] })}
          />
          <FilterSelect
            label="Status"
            value={params.statusId}
            empty="All statuses"
            options={statuses.map((s) => ({ value: String(s.id), label: s.name }))}
            onChange={(v) => update({ statusId: v ? Number(v) : undefined })}
          />
          <FilterSelect
            label="Application"
            value={params.applicationId}
            empty="All applications"
            options={(applications.data ?? []).map((a) => ({ value: String(a.id), label: a.name }))}
            onChange={(v) => update({ applicationId: v ? Number(v) : undefined })}
          />
          <FilterSelect
            label="Assignee"
            value={params.assigneeId}
            empty="Anyone"
            options={(developers.data ?? []).map((u) => ({ value: String(u.id), label: u.displayName }))}
            onChange={(v) => update({ assigneeId: v ? Number(v) : undefined })}
          />
          <FilterSelect
            label="Severity"
            value={params.severity}
            empty="All severities"
            options={severities}
            onChange={(v) => update({ severity: v as TicketListParams['severity'] })}
          />
          <FilterSelect
            label="Priority"
            value={params.priority}
            empty="All priorities"
            options={priorities}
            onChange={(v) => update({ priority: v as TicketListParams['priority'] })}
          />
        </div>

        {hasFilters(params) && (
          <div className={styles.activeFilters}>
            <span>Active filters:</span>
            {params.search && (
              <FilterChip label={`“${params.search}”`} onRemove={() => update({ search: undefined })} />
            )}
            {params.type && <FilterChip label={params.type} onRemove={() => update({ type: undefined })} />}
            {params.statusId && (
              <FilterChip label={statusName ?? 'Status'} onRemove={() => update({ statusId: undefined })} />
            )}
            {params.applicationId && (
              <FilterChip label={appName ?? 'Application'} onRemove={() => update({ applicationId: undefined })} />
            )}
            {params.assigneeId && (
              <FilterChip
                label={`Assigned to: ${assigneeName ?? 'developer'}`}
                onRemove={() => update({ assigneeId: undefined })}
              />
            )}
            {params.severity && <FilterChip label={params.severity} onRemove={() => update({ severity: undefined })} />}
            {params.priority && (
              <FilterChip label={priorityLabel(params.priority)} onRemove={() => update({ priority: undefined })} />
            )}
            <Button appearance="transparent" size="small" className={styles.clear} onClick={clearFilters}>
              Clear filters
            </Button>
          </div>
        )}
      </section>

      <section className={mergeClasses(page.panel, styles.results)} aria-label="Tickets">
        <div className={styles.resultsHead}>
          <Text weight="semibold">
            {data ? `${data.totalCount} ${data.totalCount === 1 ? 'ticket' : 'tickets'}` : 'Tickets'}
          </Text>
          <span className={styles.muted}>Sorted by {describeSort(params.sort!, params.direction!)}</span>
        </div>

        {list.isError && (
          <MessageBar intent="error">
            <MessageBarBody>Couldn’t load tickets: {list.error.message}</MessageBarBody>
          </MessageBar>
        )}

        {list.isPending && <LoadingRows />}

        {data && data.items.length === 0 && (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>
              <Search24Regular />
            </span>
            {counts.data?.all === 0 ? (
              <>
                <Text as="h2" size={500} weight="semibold">
                  No tickets yet
                </Text>
                <Text className={styles.muted}>
                  When someone reports a defect or requests an enhancement, it shows up here.
                </Text>
                <Button appearance="primary" icon={<Add20Regular />} onClick={() => void navigate('/tickets/new')}>
                  Create the first ticket
                </Button>
              </>
            ) : (
              <>
                <Text as="h2" size={500} weight="semibold">
                  No tickets found
                </Text>
                <Text className={styles.muted}>
                  Try adjusting your search or filters to find what you’re looking for.
                </Text>
                <Button onClick={() => setSearchParams(new URLSearchParams())}>Clear filters</Button>
              </>
            )}
          </div>
        )}

        {data && data.items.length > 0 && (
          <>
            <div className={mergeClasses(styles.tableWrap, list.isPlaceholderData && styles.refreshing)}>
              <Table aria-label="Tickets" className={styles.table}>
                <TableHeader>
                  <TableRow>
                    {columns.map((c) => (
                      <TableHeaderCell
                        key={c.label}
                        className={styles.headerCell}
                        sortDirection={
                          c.sort && params.sort === c.sort
                            ? params.direction === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : undefined
                        }
                        sortable={Boolean(c.sort)}
                        onClick={c.sort ? () => update(nextSort(params, c.sort!)) : undefined}
                      >
                        {c.label}
                      </TableHeaderCell>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((t) => (
                    <TableRow
                      key={t.number}
                      className={styles.row}
                      tabIndex={0}
                      onClick={(e) => onRowClick(e, t)}
                      onKeyDown={(e) => onRowKey(e, t)}
                    >
                      <TableCell className={styles.nowrap}>
                        <Link
                          to={`/tickets/${t.number}`}
                          state={{ listSearch: location.search }}
                          className={styles.number}
                        >
                          {t.displayNumber}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <TypeIcon type={t.type} />
                      </TableCell>
                      <TableCell className={styles.title}>{t.title}</TableCell>
                      <TableCell>{t.applicationName}</TableCell>
                      <TableCell>
                        <SeverityLabel severity={t.severity} />
                      </TableCell>
                      <TableCell>
                        <PriorityTag priority={t.priority} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge name={t.statusName} />
                      </TableCell>
                      <TableCell>
                        <PersonLabel person={t.assignee} />
                      </TableCell>
                      <TableCell className={mergeClasses(styles.muted, styles.nowrap)}>
                        <span title={new Date(t.updatedAt).toLocaleString()}>{relativeTime(t.updatedAt)}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <nav className={styles.pagination} aria-label="Pages">
              <span>
                {first}–{last} of {data.totalCount}
              </span>
              {totalPages > 1 && (
                <div className={styles.pages}>
                  <Button size="small" disabled={data.page <= 1} onClick={() => update({ page: data.page - 1 })}>
                    Previous
                  </Button>
                  {pageNumbers(data.page, totalPages).map((n) => (
                    <Button
                      key={n}
                      size="small"
                      appearance={n === data.page ? 'primary' : 'secondary'}
                      aria-current={n === data.page ? 'page' : undefined}
                      onClick={() => update({ page: n })}
                    >
                      {n}
                    </Button>
                  ))}
                  <Button
                    size="small"
                    disabled={data.page >= totalPages}
                    onClick={() => update({ page: data.page + 1 })}
                  >
                    Next
                  </Button>
                </div>
              )}
            </nav>
          </>
        )}
      </section>
    </div>
  )
}

/** Up to five page numbers around the current page. */
function pageNumbers(current: number, total: number): number[] {
  const start = Math.max(1, Math.min(current - 2, total - 4))
  return Array.from({ length: Math.min(5, total) }, (_, i) => start + i)
}

function FilterSelect({
  label,
  value,
  empty,
  options,
  onChange,
}: {
  label: string
  value: string | number | undefined
  empty: string
  options: { value: string; label: string }[]
  onChange: (value: string | undefined) => void
}) {
  const styles = useStyles()
  return (
    <Field className={styles.filterField} label={{ children: label, className: styles.fieldLabel }}>
      <Select
        className={styles.filterSelect}
        select={{ style: { minWidth: 0, textOverflow: 'ellipsis' } }}
        value={value === undefined ? '' : String(value)}
        onChange={(_, d) => onChange(d.value || undefined)}
      >
        <option value="">{empty}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </Field>
  )
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  const styles = useStyles()
  return (
    <button type="button" className={styles.chip} onClick={onRemove} aria-label={`Remove filter ${label}`}>
      {label}
      <Dismiss12Regular aria-hidden />
    </button>
  )
}

function LoadingRows() {
  const styles = useStyles()
  return (
    <Skeleton aria-label="Loading tickets">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className={styles.skeletonRow}>
          <SkeletonItem />
          <SkeletonItem />
          <SkeletonItem />
          <SkeletonItem />
          <SkeletonItem />
        </div>
      ))}
    </Skeleton>
  )
}
