/**
 * Seed script for the demo company "Nordisk Erhverv ApS"
 *
 * Creates a comprehensive, realistic dataset for an IT consulting & digital
 * solutions company in Copenhagen covering a rolling 3-year window ending
 * at the current date.
 *
 * Data includes: contacts, invoices, transactions, journal entries,
 * fiscal periods, bank statements, budgets, recurring entries, and
 * a bank connection.
 *
 * All dates are computed dynamically from `new Date()`.
 */

import { db } from '@/lib/db'
import { seedChartOfAccounts } from '@/lib/seed-chart-of-accounts'
import {
  TransactionType,
  InvoiceStatus,
  JournalEntryStatus,
  ContactType,
  PeriodStatus,
  VATCode,
  RecurringFrequency,
  RecurringStatus,
  ReconciliationStatus,
} from '@prisma/client'

// ─── Helpers ──────────────────────────────────────────────────────

/** Create a Date at midnight UTC for a given year/month/day */
function d(year: number, month: number, day: number): Date {
  return new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00.000Z`)
}

/** Round to 2 decimal places */
function r(n: number): number {
  return Math.round(n * 100) / 100
}

/** Compute 25% VAT from net amount */
function vat25(net: number): number {
  return r(net * 0.25)
}

/** Net + 25% VAT */
function gross25(net: number): number {
  return r(net * 1.25)
}

/** Pseudo-random seeded number for deterministic output */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280
  return x - Math.floor(x)
}

/** Add days to a Date (safe) */
function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

/** Get last day of month */
function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

// ─── Dynamic Date Ranges ──────────────────────────────────────────

const NOW = new Date()
const CURRENT_YEAR = NOW.getFullYear()
const CURRENT_MONTH = NOW.getMonth() + 1 // 1-indexed

// Year 1 = 3 years ago, Year 2 = 2 years ago, Year 3 = current year
const YEAR_1 = CURRENT_YEAR - 2
const YEAR_2 = CURRENT_YEAR - 1
const YEAR_3 = CURRENT_YEAR

// Danish month names
const MONTH_NAMES = [
  'januar', 'februar', 'marts', 'april', 'maj', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'december',
]

// ─── Growth Parameters Per Year ───────────────────────────────────

interface YearParams {
  year: number
  label: string
  salaryGross: number   // monthly gross salary (before employer contributions)
  salaryTotal: number   // total monthly salary cost
  employerPct: number   // employer contributions as fraction of gross
  pensionPct: number    // pension as fraction of gross
  rentNet: number       // monthly rent excluding VAT
  telecomNet: number    // monthly telecom excluding VAT
  insuranceQ: number    // quarterly insurance (VAT exempt)
  depreciationQ: number // quarterly depreciation
  avgInvoiceValue: number // average invoice net amount
  invoicesPerMonth: [number, number] // [min, max] invoices per month
  quarterlyRevenue: [number, number] // [min, max] per quarter
}

const YEAR_PARAMS: YearParams[] = [
  {
    year: YEAR_1,
    label: 'Start',
    salaryGross: 76000,
    salaryTotal: 100000,
    employerPct: 0.20,
    pensionPct: 0.10,
    rentNet: 16000,
    telecomNet: 5000,
    insuranceQ: 12000,
    depreciationQ: 12500,
    avgInvoiceValue: 55000,
    invoicesPerMonth: [2, 3],
    quarterlyRevenue: [650000, 800000],
  },
  {
    year: YEAR_2,
    label: 'Vækst',
    salaryGross: 95000,
    salaryTotal: 125000,
    employerPct: 0.19,
    pensionPct: 0.10,
    rentNet: 17600,
    telecomNet: 5600,
    insuranceQ: 14000,
    depreciationQ: 15000,
    avgInvoiceValue: 70000,
    invoicesPerMonth: [3, 4],
    quarterlyRevenue: [800000, 1000000],
  },
  {
    year: YEAR_3,
    label: 'Etableret',
    salaryGross: 114000,
    salaryTotal: 150000,
    employerPct: 0.18,
    pensionPct: 0.10,
    rentNet: 20000,
    telecomNet: 6400,
    insuranceQ: 16000,
    depreciationQ: 18750,
    avgInvoiceValue: 85000,
    invoicesPerMonth: [4, 5],
    quarterlyRevenue: [1000000, 1300000],
  },
]

// ─── Contact Data ─────────────────────────────────────────────────

interface ContactSeed {
  name: string
  cvrNumber: string
  email: string
  phone: string
  address: string
  city: string
  postalCode: string
  type: ContactType
  notes: string
}

const CONTACT_DATA: ContactSeed[] = [
  // Customers
  {
    name: 'DataDrift ApS',
    cvrNumber: '28473650',
    email: 'kundeservice@datadrift.dk',
    phone: '+45 33 98 76 54',
    address: 'Amagerbrogade 88',
    city: 'København S',
    postalCode: '2300',
    type: 'CUSTOMER',
    notes: 'IT services kunde – løbende rådgivningsopgaver',
  },
  {
    name: 'Copenhagen Digital Hub',
    cvrNumber: '31927481',
    email: 'info@cphdigitalhub.dk',
    phone: '+45 33 54 32 10',
    address: 'Nørrebrogade 15',
    city: 'København N',
    postalCode: '2200',
    type: 'CUSTOMER',
    notes: 'Digital transformationskunde – større projekter',
  },
  {
    name: 'Skandinavisk Tech Solutions',
    cvrNumber: '27584930',
    email: 'hello@skanditech.dk',
    phone: '+45 86 12 34 56',
    address: 'Banegårdspladsen 7',
    city: 'Aarhus C',
    postalCode: '8000',
    type: 'CUSTOMER',
    notes: 'Konsulentkunde – rådgivning og support',
  },
  {
    name: 'Nordic Cloud Partners',
    cvrNumber: '34216758',
    email: 'contact@nordiccloudpartners.dk',
    phone: '+45 33 21 98 76',
    address: 'Østergade 22',
    city: 'København K',
    postalCode: '1100',
    type: 'CUSTOMER',
    notes: 'Cloud migreringskunde – store implementationer',
  },
  // Suppliers
  {
    name: 'TechSupply Danmark',
    cvrNumber: '25837491',
    email: 'salg@techsupply.dk',
    phone: '+45 43 22 11 00',
    address: 'Herlev Hovedgade 120',
    city: 'Herlev',
    postalCode: '2730',
    type: 'SUPPLIER',
    notes: 'IT hardware leverandør – servere, workstations, peripherals',
  },
  {
    name: 'København Kontor Service',
    cvrNumber: '29104837',
    email: 'ordre@kbhkontor.dk',
    phone: '+45 33 14 55 66',
    address: 'Frederikssundsvej 34',
    city: 'København NV',
    postalCode: '2400',
    type: 'SUPPLIER',
    notes: 'Kontorartikler og kontormøbler',
  },
  {
    name: 'Dansk IT Sikkerhed',
    cvrNumber: '31746295',
    email: 'support@danskitsikkerhed.dk',
    phone: '+45 86 18 77 88',
    address: 'Søndergade 55',
    city: 'Aarhus C',
    postalCode: '8000',
    type: 'SUPPLIER',
    notes: 'Sikkerhedstjenester – penetration tests, audit, compliance',
  },
  {
    name: 'Nordisk Forsikring A/S',
    cvrNumber: '20845731',
    email: 'forsikring@nordiskforsikring.dk',
    phone: '+45 33 77 88 99',
    address: 'Bredgade 30',
    city: 'København K',
    postalCode: '1260',
    type: 'SUPPLIER',
    notes: 'Erhvervsforsikring – ansvars- og indboforsikring',
  },
]

// ─── Invoice Descriptions ────────────────────────────────────────

const INVOICE_DESCRIPTIONS_Y1 = [
  { desc: 'IT-rådgivning – ', suffixes: ['januar sprint', 'februar opgaver', 'marts vedligehold', 'Q2 support', 'juni workshop', 'juli sikkerhed', 'august optimering', 'september engagement', 'oktober analyse', 'november implementering'] },
  { desc: 'Systemintegration – ', suffixes: ['CRM platform', 'API integration', 'database migrering', 'ERP kobling', 'sky arkitektur'] },
  { desc: 'Cloud migration – ', suffixes: ['fase 1', 'fase 2', 'Azure implementering', 'AWS opsætning', 'backup løsning'] },
  { desc: 'Digital transformation – ', suffixes: ['procesoptimering', 'UX redesign', 'strategi workshop', 'data platform'] },
]

const INVOICE_DESCRIPTIONS_Y2 = [
  { desc: 'IT-rådgivning – ', suffixes: ['kontinuerlig support', 'arkitekturgennemgang', 'sikkerhedsgennemgang', 'infrastrukturplanlægning', 'cloud workshop'] },
  { desc: 'Systemintegration – ', suffixes: ['API gateway', 'DevOps setup', 'mikroservice migrering', 'CI/CD pipeline', 'monitoring platform'] },
  { desc: 'Cloud migration – ', suffixes: ['multi-cloud opsætning', ' Kubernetes klargøring', 'disaster recovery', 'serverless transformation'] },
  { desc: 'Digital transformation – ', suffixes: ['agile transition', 'data lake implementering', 'ML pipeline', 'kundeportal'] },
]

const INVOICE_DESCRIPTIONS_Y3 = [
  { desc: 'IT-rådgivning – ', suffixes: ['strategisk rådgivning', 'enterprise arkitektur', 'compliance review', 'digital due diligence', 'CTO as a service'] },
  { desc: 'Systemintegration – ', suffixes: ['enterprise integration', 'legacy modernisering', 'data mesh arkitektur', 'event-driven platform', 'API management'] },
  { desc: 'Cloud migration – ', suffixes: ['full stack cloud', 'zero-trust implementering', 'FinOps optimering', 'Green IT initiativ'] },
  { desc: 'Digital transformation – ', suffixes: ['digital strategi 2025', 'AI-readiness vurdering', 'platform engineering', 'observability setup'] },
]

// ─── Build Invoices Dynamically ──────────────────────────────────

interface InvoiceLineItem {
  description: string
  quantity: number
  unitPrice: number
  vatPercent: number
}

interface InvoiceSeed {
  invoiceNumber: string
  contactIndex: number
  issueDate: Date
  dueDate: Date
  status: InvoiceStatus
  lineItems: InvoiceLineItem[]
  notes?: string
  cancelled?: boolean
  cancelReason?: string
}

function buildInvoices(): InvoiceSeed[] {
  const invoices: InvoiceSeed[] = []
  let seq = 1

  const descriptionsByYear = [
    INVOICE_DESCRIPTIONS_Y1,
    INVOICE_DESCRIPTIONS_Y2,
    INVOICE_DESCRIPTIONS_Y3,
  ]

  for (let yi = 0; yi < 3; yi++) {
    const yp = YEAR_PARAMS[yi]
    const year = yp.year
    const descs = descriptionsByYear[yi]
    const isCurrentYear = year === YEAR_3

    // How many full months to generate
    const maxMonth = isCurrentYear ? Math.min(CURRENT_MONTH, 12) : 12

    for (let m = 1; m <= maxMonth; m++) {
      const [minInv, maxInv] = yp.invoicesPerMonth
      const count = minInv + Math.floor(seededRandom(year * 100 + m) * (maxInv - minInv + 1))

      for (let i = 0; i < count; i++) {
        const customerIdx = Math.floor(seededRandom(year * 1000 + m * 10 + i * 3) * 4)
        const descIdx = Math.floor(seededRandom(year * 1000 + m * 10 + i * 7) * 4)
        const suffixIdx = Math.floor(seededRandom(year * 1000 + m * 10 + i * 11) * descs[descIdx].suffixes.length)

        // Scale invoice value with some variation
        const valueMultiplier = 0.6 + seededRandom(year * 1000 + m * 10 + i * 13) * 0.8
        const unitPrice = Math.round(yp.avgInvoiceValue * valueMultiplier / 1000) * 1000
        const clampedPrice = Math.max(15000, unitPrice)

        const issueDay = 5 + Math.floor(seededRandom(year * 1000 + m * 10 + i * 17) * 18)
        const issueDate = d(year, m, Math.min(issueDay, lastDayOfMonth(year, m)))

        // Due date: 30 days after issue
        const dueDate = addDays(issueDate, 30)

        // Determine status based on timing
        let status: InvoiceStatus
        if (isCurrentYear && m >= CURRENT_MONTH - 1) {
          // Recent invoices in current year: mix of SENT (some overdue) and DRAFT
          if (i === count - 1 && m === maxMonth) {
            status = 'DRAFT'
          } else {
            status = 'SENT'
          }
        } else if (isCurrentYear && m >= maxMonth - 2) {
          status = i < count - 1 ? 'SENT' : 'DRAFT'
        } else {
          // Older invoices: mostly PAID
          const isCancelled = seededRandom(year * 1000 + m * 10 + i * 23) > 0.92
          if (isCancelled) {
            status = 'CANCELLED'
          } else {
            status = 'PAID'
          }
        }

        const invoiceNumber = `NE-${year}-${String(seq).padStart(4, '0')}`
        seq++

        const description = `${descs[descIdx].desc}${descs[descIdx].suffixes[suffixIdx]}`

        // Some invoices have a second line item
        const hasSecondLine = seededRandom(year * 1000 + m * 10 + i * 29) > 0.6
        const lineItems: InvoiceLineItem[] = [
          { description, quantity: 1, unitPrice: clampedPrice, vatPercent: 25 },
        ]
        if (hasSecondLine) {
          const secondLinePrice = Math.round(clampedPrice * (0.1 + seededRandom(year * 1000 + m * 10 + i * 31) * 0.2) / 500) * 500
          lineItems.push({
            description: 'Tillægsydelser og dokumentation',
            quantity: 1,
            unitPrice: Math.max(5000, secondLinePrice),
            vatPercent: 25,
          })
        }

        invoices.push({
          invoiceNumber,
          contactIndex: customerIdx,
          issueDate,
          dueDate,
          status,
          lineItems,
          cancelled: status === 'CANCELLED',
          cancelReason: status === 'CANCELLED'
            ? seededRandom(year * 1000 + m * 10 + i * 37) > 0.5
              ? 'Dublet faktura – annulleret'
              : 'Scope ændring – projekt aflyst'
            : undefined,
        })
      }
    }
  }

  // Ensure overdue invoices: among the current year's SENT invoices,
  // adjust dueDate of the last 2-3 SENT invoices to be 5-25 days in the past
  const sentInCurrentYear = invoices.filter(
    (inv) => inv.status === 'SENT' && inv.issueDate.getFullYear() === YEAR_3
  )

  // Take the most recent SENT invoices and make them overdue
  let overdueCount = 0
  for (let i = sentInCurrentYear.length - 1; i >= 0 && overdueCount < 3; i--) {
    const inv = sentInCurrentYear[i]
    // Set due date to between 5-25 days in the past
    const daysAgo = 5 + Math.floor(seededRandom(i * 41 + 7) * 21)
    inv.dueDate = addDays(NOW, -daysAgo)
    // Move issue date to before due date
    inv.issueDate = addDays(inv.dueDate, -30)
    overdueCount++
  }

  return invoices
}

// ─── Build Transactions Dynamically ──────────────────────────────

interface TransactionSeed {
  date: Date
  type: TransactionType
  amount: number
  description: string
  vatPercent: number
  contactIndex?: number
}

function buildTransactions(): TransactionSeed[] {
  const transactions: TransactionSeed[] = []

  for (let yi = 0; yi < 3; yi++) {
    const yp = YEAR_PARAMS[yi]
    const year = yp.year
    const isCurrentYear = year === YEAR_3
    const maxMonth = isCurrentYear ? Math.min(CURRENT_MONTH, 12) : 12

    for (let m = 1; m <= maxMonth; m++) {
      const seed = year * 100 + m

      // Salary (mid-month)
      transactions.push({
        date: d(year, m, 15),
        type: 'SALARY',
        amount: yp.salaryTotal,
        description: `Lønninger ${MONTH_NAMES[m - 1]} ${year}`,
        vatPercent: 0,
      })

      // Rent (1st of month)
      transactions.push({
        date: d(year, m, 1),
        type: 'PURCHASE',
        amount: gross25(yp.rentNet),
        description: `Husleje ${MONTH_NAMES[m - 1]} – Vesterbrogade 42`,
        vatPercent: 25,
        contactIndex: 7, // Nordisk Forsikring -> but actually rent goes to landlord
      })

      // Telecom (5th)
      transactions.push({
        date: d(year, m, 5),
        type: 'PURCHASE',
        amount: gross25(yp.telecomNet),
        description: `Telefon og internet ${MONTH_NAMES[m - 1]} ${year}`,
        vatPercent: 25,
      })

      // Sales (2-3 per month, scaled by year)
      const saleCount = 2 + Math.floor(seededRandom(seed * 3) * 2)
      for (let s = 0; s < saleCount; s++) {
        const custIdx = Math.floor(seededRandom(seed * 100 + s * 7) * 4)
        const baseAmount = yp.quarterlyRevenue[0] / 3
        const variation = (seededRandom(seed * 100 + s * 13) - 0.3) * baseAmount * 0.8
        const amount = Math.round(Math.max(20000, baseAmount + variation) / 100) * 100

        const customerNames = ['DataDrift', 'Cph Digital Hub', 'Skand Tech', 'Nordic Cloud']
        const projectDescs = ['IT-rådgivning', 'Systemintegration', 'Cloud migration', 'Digital transformation', 'IT-support', 'Workshop']
        const descIdx = Math.floor(seededRandom(seed * 100 + s * 17) * projectDescs.length)

        transactions.push({
          date: d(year, m, 3 + Math.floor(seededRandom(seed * 100 + s * 19) * 22)),
          type: 'SALE',
          amount: gross25(amount),
          description: `${customerNames[custIdx]} – ${projectDescs[descIdx]} ${MONTH_NAMES[m - 1]}`,
          vatPercent: 25,
          contactIndex: custIdx,
        })
      }

      // Purchases (1-2 per month)
      const purchaseCount = 1 + Math.floor(seededRandom(seed * 5) * 2)
      const suppliers = ['TechSupply', 'Dansk IT Sikkerhed', 'Kbh Kontor']
      const purchaseDescs = [
        ['Workstation opgradering', 'Server hardware', 'Laptops til konsulenter', 'Netværksudstyr', 'Skærme og tilbehør'],
        ['Penetration test', 'Compliance audit', 'Sikkerhedsscanning', 'Årlig sikkerhedsrevision'],
        ['Kontorartikler', 'Printer toner', 'Kontormøbler', 'Rengøringsartikler'],
      ]
      for (let p = 0; p < purchaseCount; p++) {
        const supIdx = Math.floor(seededRandom(seed * 200 + p * 11) * 3)
        const descIdx = Math.floor(seededRandom(seed * 200 + p * 23) * purchaseDescs[supIdx].length)
        const basePurchase = supIdx === 0 ? 30000 : supIdx === 1 ? 40000 : 5000
        const amount = Math.round(basePurchase * (0.5 + seededRandom(seed * 200 + p * 29) * 1.0) / 100) * 100

        transactions.push({
          date: d(year, m, 8 + Math.floor(seededRandom(seed * 200 + p * 31) * 18)),
          type: 'PURCHASE',
          amount: gross25(amount),
          description: `${suppliers[supIdx]} – ${purchaseDescs[supIdx][descIdx]}`,
          vatPercent: 25,
          contactIndex: 4 + supIdx,
        })
      }

      // Quarterly events
      const quarter = Math.ceil(m / 3)

      // VAT payment (end of quarter month)
      if (m % 3 === 0) {
        const vatBase = yp.quarterlyRevenue[0] * 0.25 * 0.25 // rough output VAT
        const vatAmount = Math.round(vatBase * (0.8 + seededRandom(seed * 400) * 0.4) / 100) * 100
        transactions.push({
          date: d(year, m, lastDayOfMonth(year, m)),
          type: 'BANK',
          amount: vatAmount,
          description: `Momsbetaling Q${quarter} ${year}`,
          vatPercent: 0,
        })
      }

      // Insurance (Q1, Q2, Q3, Q4 starting months)
      if (m === 1 || m === 4 || m === 7 || m === 10) {
        transactions.push({
          date: d(year, m, 10),
          type: 'PURCHASE',
          amount: yp.insuranceQ,
          description: `Erhvervsforsikring Q${quarter} – Nordisk Forsikring`,
          vatPercent: 0,
          contactIndex: 7,
        })
      }

      // Interest income (quarterly)
      if (m % 3 === 0) {
        const interest = Math.round((500 + yi * 500 + seededRandom(seed * 500) * 2000) / 100) * 100
        transactions.push({
          date: d(year, m, lastDayOfMonth(year, m)),
          type: 'BANK',
          amount: interest,
          description: `Renteindtægt Q${quarter} ${year}`,
          vatPercent: 0,
        })
      }

      // Bank fees (semi-annually)
      if (m === 1 || m === 7) {
        transactions.push({
          date: d(year, m, 25),
          type: 'BANK',
          amount: 1800 + Math.round(seededRandom(seed * 600) * 1200),
          description: `Bankgebyrer H${m <= 6 ? 1 : 2} ${year}`,
          vatPercent: 0,
        })
      }

      // Marketing (bimonthly, more in later years)
      if (m % 2 === 0 || (yi >= 1 && m % 2 === 1)) {
        const marketingBase = 4000 + yi * 2000
        const marketing = Math.round(marketingBase * (0.5 + seededRandom(seed * 700) * 1.0) / 100) * 100
        transactions.push({
          date: d(year, m, 20),
          type: 'PURCHASE',
          amount: gross25(marketing),
          description: `Markedsføring – ${seededRandom(seed * 700) > 0.5 ? 'Google Ads' : 'LinkedIn'} ${MONTH_NAMES[m - 1]}`,
          vatPercent: 25,
        })
      }

      // Corporate tax (December of each year except current if not yet December)
      if (m === 12 && !isCurrentYear) {
        const taxEstimate = Math.round(yp.quarterlyRevenue[0] * 4 * 0.06 / 1000) * 1000
        transactions.push({
          date: d(year, 12, 22),
          type: 'BANK',
          amount: taxEstimate,
          description: `Selskabsskat ${year}`,
          vatPercent: 0,
        })
      }

      // Interest expense (semi-annually)
      if (m === 6 || m === 12) {
        transactions.push({
          date: d(year, m, lastDayOfMonth(year, m)),
          type: 'BANK',
          amount: 1500 + Math.round(seededRandom(seed * 800) * 1500),
          description: `Renteomkostninger H${m <= 6 ? 1 : 2} ${year}`,
          vatPercent: 0,
        })
      }
    }
  }

  return transactions
}

// ─── Journal Entry Data ──────────────────────────────────────────

interface JELineSeed {
  accountNumber: string
  debit: number
  credit: number
  vatCode?: VATCode
  description?: string
}

interface JESeed {
  date: Date
  description: string
  reference?: string
  status: JournalEntryStatus
  lines: JELineSeed[]
}

/**
 * Build journal entries across 3 years.
 * Includes: opening balance, revenue, expenses, VAT settlements,
 * year-end closings, and financial items.
 */
function buildJournalEntries(): JESeed[] {
  const entries: JESeed[] = []

  // ── Opening balance: Share capital injection ──
  entries.push({
    date: d(YEAR_1, 1, 1),
    description: 'Indbetaling af selskabskapital ved stiftelse',
    reference: 'STIFTELSE-001',
    status: 'POSTED',
    lines: [
      { accountNumber: '1100', debit: 500000, credit: 0, vatCode: 'NONE', description: 'Indskud af selskabskapital på bankkonto' },
      { accountNumber: '3000', debit: 0, credit: 500000, vatCode: 'NONE', description: 'Selskabskapital' },
    ],
  })

  // Track cumulative net income per year for closing entries
  const yearlyNetIncome: number[] = [0, 0, 0]

  for (let yi = 0; yi < 3; yi++) {
    const yp = YEAR_PARAMS[yi]
    const year = yp.year
    const isCurrentYear = year === YEAR_3
    const maxMonth = isCurrentYear ? Math.min(CURRENT_MONTH, 12) : 12

    for (let m = 1; m <= maxMonth; m++) {
      const quarter = Math.ceil(m / 3)
      const isLastMonth = isCurrentYear && m === maxMonth
      // POSTED for all past months, DRAFT for the very last month
      const status: JournalEntryStatus = isLastMonth ? 'DRAFT' : 'POSTED'

      // ── Monthly salary journal entry ──
      const employerAmt = Math.round(yp.salaryGross * yp.employerPct / 100) * 100
      const pensionAmt = Math.round(yp.salaryGross * yp.pensionPct / 100) * 100
      const salaryCredit = yp.salaryGross + employerAmt + pensionAmt // credit must equal sum of debits
      entries.push({
        date: d(year, m, 25),
        description: `Lønafregning ${MONTH_NAMES[m - 1]} ${year}`,
        reference: `LØN-${year}-${String(m).padStart(2, '0')}`,
        status,
        lines: [
          { accountNumber: '7000', debit: yp.salaryGross, credit: 0, vatCode: 'NONE', description: 'Bruttolønninger' },
          { accountNumber: '7100', debit: employerAmt, credit: 0, vatCode: 'NONE', description: 'ATP og arbejdsgiverbidrag' },
          { accountNumber: '7200', debit: pensionAmt, credit: 0, vatCode: 'NONE', description: 'Pensionsbidrag' },
          { accountNumber: '1100', debit: 0, credit: salaryCredit, vatCode: 'NONE', description: 'Udbetaling fra bankkonto' },
        ],
      })

      // ── Monthly rent journal entry ──
      entries.push({
        date: d(year, m, 1),
        description: `Husleje ${MONTH_NAMES[m - 1]} ${year} – Vesterbrogade 42`,
        reference: `LEJE-${year}-${String(m).padStart(2, '0')}`,
        status,
        lines: [
          { accountNumber: '8000', debit: yp.rentNet, credit: 0, vatCode: 'NONE', description: 'Husleje ekskl. moms' },
          { accountNumber: '5410', debit: vat25(yp.rentNet), credit: 0, vatCode: 'K25', description: 'Indgående moms 25%' },
          { accountNumber: '1100', debit: 0, credit: gross25(yp.rentNet), vatCode: 'NONE', description: 'Betaling fra bankkonto' },
        ],
      })

      // ── Monthly telecom journal entry ──
      entries.push({
        date: d(year, m, 5),
        description: `Telefon og internet ${MONTH_NAMES[m - 1]} ${year}`,
        reference: `TEL-${year}-${String(m).padStart(2, '0')}`,
        status,
        lines: [
          { accountNumber: '8600', debit: yp.telecomNet, credit: 0, vatCode: 'NONE', description: 'Telefon og internet ekskl. moms' },
          { accountNumber: '5410', debit: vat25(yp.telecomNet), credit: 0, vatCode: 'K25', description: 'Indgående moms 25%' },
          { accountNumber: '1100', debit: 0, credit: gross25(yp.telecomNet), vatCode: 'NONE', description: 'Betaling fra bankkonto' },
        ],
      })

      // ── Quarterly insurance ──
      if (m === 1 || m === 4 || m === 7 || m === 10) {
        entries.push({
          date: d(year, m, 10),
          description: `Erhvervsforsikring Q${quarter} ${year} – Nordisk Forsikring A/S`,
          reference: `FOR-${year}-Q${quarter}`,
          status,
          lines: [
            { accountNumber: '8400', debit: yp.insuranceQ, credit: 0, vatCode: 'NONE', description: 'Forsikringspræmie (momsfri)' },
            { accountNumber: '1100', debit: 0, credit: yp.insuranceQ, vatCode: 'NONE', description: 'Betaling fra bankkonto' },
          ],
        })
      }

      // ── Quarterly depreciation ──
      if (m % 3 === 0) {
        entries.push({
          date: d(year, m, lastDayOfMonth(year, m)),
          description: `Afskrivning på IT-udstyr Q${quarter} ${year}`,
          reference: `AFS-${year}-Q${quarter}`,
          status,
          lines: [
            { accountNumber: '8900', debit: yp.depreciationQ, credit: 0, vatCode: 'NONE', description: 'Afskrivning IT-udstyr' },
            { accountNumber: '1800', debit: 0, credit: yp.depreciationQ, vatCode: 'NONE', description: 'Nedskrivning af anlægsaktiv' },
          ],
        })
      }

      // ── Quarterly VAT settlement ──
      if (m % 3 === 0) {
        // Rough output/input VAT based on revenue and expenses
        const outputVat = Math.round(yp.quarterlyRevenue[0] * 0.25 * (0.7 + seededRandom(year * 100 + m) * 0.3))
        const inputVat = Math.round((gross25(yp.rentNet) + gross25(yp.telecomNet)) * 3 * 0.25 * (0.6 + seededRandom(year * 100 + m + 50) * 0.4))
        const vatNet = r(outputVat - inputVat)
        entries.push({
          date: d(year, m, lastDayOfMonth(year, m)),
          description: `Momsafregning Q${quarter} ${year} – indbetaling til Skattestyrelsen`,
          reference: `MOMS-${year}-Q${quarter}`,
          status,
          lines: [
            { accountNumber: '4510', debit: outputVat, credit: 0, vatCode: 'NONE', description: `Udgående moms Q${quarter} afregnet` },
            { accountNumber: '5410', debit: 0, credit: inputVat, vatCode: 'NONE', description: `Indgående moms Q${quarter} afregnet` },
            { accountNumber: '1100', debit: 0, credit: vatNet, vatCode: 'NONE', description: 'Momsbetaling fra bankkonto' },
          ],
        })
      }

      // ── Purchase journal entries (1 per month for larger purchases) ──
      // Purchases are recorded on payables (2000); payments clear payables later.
      // For the most recent month in current year, no payment entry is created
      // so those purchases remain as outstanding payables for the aging report.
      const purchaseAccounts = ['1800', '8400'] // IT equipment or insurance/security
      const purchaseDescriptions = [
        'TechSupply – hardware indkøb',
        'Dansk IT Sikkerhed – sikkerhedsydelser',
        'København Kontor – kontorartikler og forbrug',
      ]
      const pIdx = Math.floor(seededRandom(year * 100 + m * 3) * 3)
      const purchaseNet = Math.round((20000 + yp.avgInvoiceValue * 0.3 * seededRandom(year * 100 + m * 7)) / 100) * 100
      const purchaseGross = gross25(purchaseNet)
      const pAcct = purchaseAccounts[pIdx === 2 ? 1 : 0] // Office supplies go to expense
      const purchaseRef = `LEV-${year}-${String(m).padStart(2, '0')}`
      const purchaseDate = d(year, m, 15)

      // Determine if this purchase should have a payment entry:
      // - Past years: always paid (15-30 days after purchase)
      // - Current year: only months older than the most recent month get payment entries
      const purchaseShouldPay = !isCurrentYear || (m < maxMonth)

      // Purchase entry: debit expense + VAT, credit payables (2000)
      entries.push({
        date: purchaseDate,
        description: `${purchaseDescriptions[pIdx]} ${MONTH_NAMES[m - 1]} ${year}`,
        reference: purchaseRef,
        status,
        lines: pIdx === 2
          ? [
              { accountNumber: '8700', debit: purchaseNet, credit: 0, vatCode: 'NONE', description: 'Kontorartikler ekskl. moms' },
              { accountNumber: '5410', debit: vat25(purchaseNet), credit: 0, vatCode: 'K25', description: 'Indgående moms 25%' },
              { accountNumber: '2000', debit: 0, credit: purchaseGross, vatCode: 'NONE', description: 'Leverandørgæld – kontorartikler' },
            ]
          : [
              { accountNumber: pAcct, debit: purchaseNet, credit: 0, vatCode: 'NONE', description: 'Omkostning ekskl. moms' },
              { accountNumber: '5410', debit: vat25(purchaseNet), credit: 0, vatCode: 'K25', description: 'Indgående moms 25%' },
              { accountNumber: '2000', debit: 0, credit: purchaseGross, vatCode: 'NONE', description: 'Leverandørgæld – indkøb' },
            ],
      })

      // Payment entry: debit payables (2000), credit bank (1100) — 15-30 days later
      if (purchaseShouldPay && status === 'POSTED') {
        const paymentDelay = 15 + Math.floor(seededRandom(year * 100 + m * 11) * 16)
        const payDate = addDays(purchaseDate, paymentDelay)
        entries.push({
          date: payDate,
          description: `Betaling til leverandør – ${purchaseDescriptions[pIdx]}`,
          reference: `BET-${purchaseRef}`,
          status: 'POSTED',
          lines: [
            { accountNumber: '2000', debit: purchaseGross, credit: 0, vatCode: 'NONE', description: 'Kreditering af leverandørgæld' },
            { accountNumber: '1100', debit: 0, credit: purchaseGross, vatCode: 'NONE', description: 'Betaling fra bankkonto' },
          ],
        })
      }
    }

    // ── Corporate tax (year-end) ──
    if (!isCurrentYear || CURRENT_MONTH >= 12) {
      const taxEstimate = Math.round(yp.quarterlyRevenue[0] * 4 * 0.06 / 1000) * 1000
      entries.push({
        date: d(year, 12, 22),
        description: `Betalingsanvisning selskabsskat ${year}`,
        reference: `SKAT-${year}`,
        status: isCurrentYear ? 'DRAFT' : 'POSTED',
        lines: [
          { accountNumber: '9500', debit: taxEstimate, credit: 0, vatCode: 'NONE', description: 'Årets skat af resultat' },
          { accountNumber: '1100', debit: 0, credit: taxEstimate, vatCode: 'NONE', description: 'Skattebetaling fra bankkonto' },
        ],
      })
    }

    // ── Semi-annual interest expense ──
    const interestExpense = 1500 + Math.round(seededRandom(year * 99) * 2000)
    entries.push({
      date: d(year, 6, 30),
      description: `Renteomkostninger H1 ${year} – banklån`,
      reference: `RENTE-${year}-H1`,
      status: 'POSTED',
      lines: [
        { accountNumber: '9100', debit: interestExpense, credit: 0, vatCode: 'NONE', description: 'Renteomkostninger' },
        { accountNumber: '1100', debit: 0, credit: interestExpense, vatCode: 'NONE', description: 'Renteudbetaling' },
      ],
    })
    entries.push({
      date: d(year, 12, 30),
      description: `Renteomkostninger H2 ${year} – banklån`,
      reference: `RENTE-${year}-H2`,
      status: isCurrentYear ? 'DRAFT' : 'POSTED',
      lines: [
        { accountNumber: '9100', debit: interestExpense, credit: 0, vatCode: 'NONE', description: 'Renteomkostninger' },
        { accountNumber: '1100', debit: 0, credit: interestExpense, vatCode: 'NONE', description: 'Renteudbetaling' },
      ],
    })

    // ── Bank fees (semi-annually) ──
    const bankFee1 = Math.round((1800 + seededRandom(year * 77) * 1200) / 100) * 100
    const bankFee2 = Math.round((1500 + seededRandom(year * 88) * 1500) / 100) * 100
    entries.push({
      date: d(year, 1, 25),
      description: `Bankgebyrer Q4 ${year - 1} – Nordea`,
      reference: `BANK-${year}-001`,
      status: 'POSTED',
      lines: [
        { accountNumber: '9000', debit: bankFee1, credit: 0, vatCode: 'NONE', description: 'Bankgebyrer og kortgebyrer' },
        { accountNumber: '1100', debit: 0, credit: bankFee1, vatCode: 'NONE', description: 'Afgift trukket fra bankkonto' },
      ],
    })
    entries.push({
      date: d(year, 7, 5),
      description: `Bankgebyrer H1 ${year} – Nordea`,
      reference: `BANK-${year}-002`,
      status: 'POSTED',
      lines: [
        { accountNumber: '9000', debit: bankFee2, credit: 0, vatCode: 'NONE', description: 'Bankgebyrer og kortgebyrer' },
        { accountNumber: '1100', debit: 0, credit: bankFee2, vatCode: 'NONE', description: 'Afgift trukket fra bankkonto' },
      ],
    })

    // ── Marketing expenses (quarterly) ──
    for (let q = 0; q < 4; q++) {
      const m = q * 3 + 2 // Feb, May, Aug, Nov
      const marketingNet = Math.round((4000 + yi * 3000 + seededRandom(year * 100 + q * 13) * 8000) / 100) * 100
      entries.push({
        date: d(year, m, 28),
        description: `Markedsføring Q${q + 1} ${year} – online kampagner`,
        reference: `MARK-${year}-Q${q + 1}`,
        status: 'POSTED',
        lines: [
          { accountNumber: '8800', debit: marketingNet, credit: 0, vatCode: 'NONE', description: 'Markedsføring ekskl. moms' },
          { accountNumber: '5410', debit: vat25(marketingNet), credit: 0, vatCode: 'K25', description: 'Indgående moms 25%' },
          { accountNumber: '1100', debit: 0, credit: gross25(marketingNet), vatCode: 'NONE', description: 'Betaling fra bankkonto' },
        ],
      })
    }

    // ── Interest income (annual) ──
    const interestIncome = Math.round((2000 + yi * 1500 + seededRandom(year * 55) * 3000) / 100) * 100
    entries.push({
      date: d(year, 12, 30),
      description: `Renteindtægter ${year} – bankindestående Nordea`,
      reference: `RENTEIND-${year}`,
      status: isCurrentYear ? 'DRAFT' : 'POSTED',
      lines: [
        { accountNumber: '1100', debit: interestIncome, credit: 0, vatCode: 'NONE', description: 'Modtagne renter' },
        { accountNumber: '9300', debit: 0, credit: interestIncome, vatCode: 'NONE', description: 'Renteindtægter fra bank' },
      ],
    })

    // ── Year-end closing: transfer net income to retained earnings ──
    // Calculate approximate net income for this year
    // Revenue: ~quarterlyRevenue[0]*4/monthly variation
    // Expenses: salary*12 + rent*12 + telecom*12 + insurance*4 + depreciation*4 + purchases*12 + marketing*4 + bankFees*2 + interestExpense*2
    const monthlyRevenueNet = Math.round(yp.quarterlyRevenue[0] / 3 * 1.1) // with some uplift
    const monthlyExpenseNet = Math.round(
      yp.salaryGross + Math.round(yp.salaryGross * yp.employerPct / 100) * 100 + Math.round(yp.salaryGross * yp.pensionPct / 100) * 100
      + yp.rentNet + yp.telecomNet
      + (yp.insuranceQ / 3) + (yp.depreciationQ / 3)
      + (20000 + yp.avgInvoiceValue * 0.2) // approx purchase
      + 6000 // approx marketing per month
    )
    const annualNetBeforeTax = (monthlyRevenueNet - monthlyExpenseNet) * maxMonth
    const corporateTax = !isCurrentYear || CURRENT_MONTH >= 12 ? Math.round(yp.quarterlyRevenue[0] * 4 * 0.06 / 1000) * 1000 : 0
    const netIncomeAfterTax = annualNetBeforeTax - corporateTax
    yearlyNetIncome[yi] = netIncomeAfterTax

    if (!isCurrentYear) {
      // For past years: close net income to retained earnings
      if (netIncomeAfterTax > 0) {
        entries.push({
          date: d(year, 12, 31),
          description: `Årsafslut ${year} – resultatoverførsel til overskud`,
          reference: `AARSAFSLUT-${year}`,
          status: 'POSTED',
          lines: [
            { accountNumber: '3300', debit: 0, credit: netIncomeAfterTax, vatCode: 'NONE', description: 'Årets resultat' },
            { accountNumber: '3400', debit: netIncomeAfterTax, credit: 0, vatCode: 'NONE', description: 'Overført til overskud' },
          ],
        })
      }
    }
  }

  // ── REVENUE ENTRIES: Add 2-3 revenue journal entries per month ──
  // These must be added AFTER the expense loop so we can reference yearlyNetIncome
  // We insert them into the entries array in chronological order
  // Revenue is recorded on receivables (1200); payments clear receivables later.
  // For the most recent 2 months in current year, no payment entries are created
  // so those invoices remain as outstanding receivables for the aging report.
  const revenueEntries: JESeed[] = []
  const customerNames = ['DataDrift ApS', 'Copenhagen Digital Hub', 'Skandinavisk Tech Solutions', 'Nordic Cloud Partners']
  const serviceDescs = ['IT-rådgivning', 'Systemintegration', 'Cloud migration', 'Digital transformation', 'Konsulentbistand', 'Strategisk rådgivning']

  for (let yi = 0; yi < 3; yi++) {
    const yp = YEAR_PARAMS[yi]
    const year = yp.year
    const isCurrentYear = year === YEAR_3
    const maxMonth = isCurrentYear ? Math.min(CURRENT_MONTH, 12) : 12

    for (let m = 1; m <= maxMonth; m++) {
      const isLastMonth = isCurrentYear && m === maxMonth
      const status: JournalEntryStatus = isLastMonth ? 'DRAFT' : 'POSTED'

      // Determine if this revenue should have a payment entry:
      // - Past years: always paid (30 days after invoice)
      // - Current year: only months older than 2 months ago get payment entries
      const shouldCreatePayment = !isCurrentYear || (m <= CURRENT_MONTH - 2)

      // 2-3 revenue entries per month
      const revenueCount = 2 + Math.floor(seededRandom(year * 100 + m * 53) * 2)
      for (let ri = 0; ri < revenueCount; ri++) {
        const baseRevenue = yp.quarterlyRevenue[0] / 3 / revenueCount
        const variation = (seededRandom(year * 1000 + m * 10 + ri * 71) - 0.3) * baseRevenue * 0.6
        const revenueNet = Math.round(Math.max(15000, baseRevenue + variation) / 100) * 100
        const revenueVat = vat25(revenueNet)
        const revenueGross = r(revenueNet + revenueVat)

        const custName = customerNames[Math.floor(seededRandom(year * 1000 + m * 10 + ri * 73) * 4)]
        const serviceDesc = serviceDescs[Math.floor(seededRandom(year * 1000 + m * 10 + ri * 79) * serviceDescs.length)]
        const day = 3 + Math.floor(seededRandom(year * 1000 + m * 10 + ri * 83) * 22)
        const invoiceDate = d(year, m, Math.min(day, lastDayOfMonth(year, m)))
        const refNum = `SALG-${year}-${String(m).padStart(2, '0')}-${String(ri + 1).padStart(2, '0')}`

        // Invoice entry: debit receivables (1200), credit revenue + VAT
        revenueEntries.push({
          date: invoiceDate,
          description: `Faktura ${custName} – ${serviceDesc} ${MONTH_NAMES[m - 1]} ${year}`,
          reference: refNum,
          status,
          lines: [
            { accountNumber: '1200', debit: revenueGross, credit: 0, vatCode: 'NONE', description: `Tilgodehavende fra ${custName}` },
            { accountNumber: '4100', debit: 0, credit: revenueNet, vatCode: 'NONE', description: `Serviceydelse – ${serviceDesc}` },
            { accountNumber: '4510', debit: 0, credit: revenueVat, vatCode: 'S25', description: 'Udgående moms 25%' },
          ],
        })

        // Payment entry: debit bank (1100), credit receivables (1200) — 30 days later
        if (shouldCreatePayment && status === 'POSTED') {
          const paymentDate = addDays(invoiceDate, 30)
          revenueEntries.push({
            date: paymentDate,
            description: `Kundebetaling modtaget – ${custName} (${refNum})`,
            reference: `BET-${refNum}`,
            status: 'POSTED',
            lines: [
              { accountNumber: '1100', debit: revenueGross, credit: 0, vatCode: 'NONE', description: `Indbetaling fra ${custName}` },
              { accountNumber: '1200', debit: 0, credit: revenueGross, vatCode: 'NONE', description: `Kreditering af tilgodehavende` },
            ],
          })
        }
      }
    }
  }

  // Insert revenue entries in chronological order into the main entries array
  entries.push(...revenueEntries)
  // Sort all entries by date for clean chronological ordering
  entries.sort((a, b) => a.date.getTime() - b.date.getTime())

  return entries
}

// ─── Bank Statement Data ─────────────────────────────────────────

interface StatementLineSeed {
  date: Date
  description: string
  reference: string | null
  amount: number
  balance: number
  reconciliationStatus: ReconciliationStatus
}

interface BankStatementSeed {
  startDate: Date
  endDate: Date
  openingBalance: number
  closingBalance: number
  lines: StatementLineSeed[]
}

function buildBankStatements(): BankStatementSeed[] {
  const statements: BankStatementSeed[] = []

  // Starting balance trajectory: 200K -> ~600K -> ~1100K -> ~1800K
  const startBalances = [200000, 600000, 1100000]
  const endBalances = [580000, 1080000, 1800000]

  for (let yi = 0; yi < 3; yi++) {
    const yp = YEAR_PARAMS[yi]
    const year = yp.year
    const isCurrentYear = year === YEAR_3
    const maxMonth = isCurrentYear ? Math.min(CURRENT_MONTH, 12) : 12

    // Generate 4 quarterly statements per year
    for (let q = 0; q < 4; q++) {
      const qStart = q * 3 + 1
      const qEnd = Math.min(q * 3 + 3, maxMonth)

      if (qStart > maxMonth) break

      const startDate = d(year, qStart, 1)
      const endDate = d(year, qEnd, lastDayOfMonth(year, qEnd))

      // Opening balance interpolation
      const yearProgress = q / 4
      const openBal = Math.round(startBalances[yi] + (endBalances[yi] - startBalances[yi]) * yearProgress)
      const closeTarget = Math.round(startBalances[yi] + (endBalances[yi] - startBalances[yi]) * ((q + 1) / 4))

      const lines: StatementLineSeed[] = []
      let balance = openBal

      for (let m = qStart; m <= qEnd; m++) {
        const seed = year * 100 + m

        // Salary outflow
        balance -= yp.salaryTotal
        lines.push({
          date: d(year, m, 15),
          description: `Lønafregning ${MONTH_NAMES[m - 1]}`,
          reference: `LØN-${year}-${String(m).padStart(2, '0')}`,
          amount: -yp.salaryTotal,
          balance: Math.round(balance),
          reconciliationStatus: 'MATCHED',
        })

        // Rent outflow
        balance -= gross25(yp.rentNet)
        lines.push({
          date: d(year, m, 1),
          description: 'Husleje – Vesterbrogade 42',
          reference: `LEJE-${year}-${String(m).padStart(2, '0')}`,
          amount: -gross25(yp.rentNet),
          balance: Math.round(balance),
          reconciliationStatus: 'MATCHED',
        })

        // 2 sales inflows
        for (let s = 0; s < 2; s++) {
          const saleAmount = Math.round((yp.avgInvoiceValue * (0.5 + seededRandom(seed * 100 + s * 7) * 1.0)) / 100) * 100
          balance += gross25(saleAmount)
          const custNames = ['DataDrift ApS', 'Cph Digital Hub', 'Skand Tech', 'Nordic Cloud']
          lines.push({
            date: d(year, m, 5 + Math.floor(seededRandom(seed * 100 + s * 13) * 18)),
            description: `${custNames[Math.floor(seededRandom(seed * 100 + s * 19) * 4)]} – projektbetaling`,
            reference: null,
            amount: gross25(saleAmount),
            balance: Math.round(balance),
            reconciliationStatus: seededRandom(seed * 100 + s * 23) > 0.3 ? 'MATCHED' : 'AI_SUGGESTED',
          })
        }

        // Purchase outflow
        const purchaseAmt = Math.round((15000 + seededRandom(seed * 300) * 30000) / 100) * 100
        balance -= gross25(purchaseAmt)
        lines.push({
          date: d(year, m, 10 + Math.floor(seededRandom(seed * 300) * 15)),
          description: `${seededRandom(seed * 300) > 0.5 ? 'TechSupply' : 'Kbh Kontor'} – indkøb`,
          reference: null,
          amount: -gross25(purchaseAmt),
          balance: Math.round(balance),
          reconciliationStatus: 'MATCHED',
        })

        // VAT payment at quarter end
        if (m % 3 === 0) {
          const vatPay = Math.round(balance * 0.08)
          balance -= vatPay
          lines.push({
            date: d(year, m, lastDayOfMonth(year, m)),
            description: `Skattestyrelsen – Moms Q${Math.ceil(m / 3)}`,
            reference: `MOMS-${year}-Q${Math.ceil(m / 3)}`,
            amount: -vatPay,
            balance: Math.round(balance),
            reconciliationStatus: 'MATCHED',
          })
        }
      }

      // Adjust closing balance to target
      const diff = closeTarget - Math.round(balance)
      if (diff !== 0) {
        lines.push({
          date: endDate,
          description: 'Kontoafstemning – justering',
          reference: null,
          amount: diff,
          balance: closeTarget,
          reconciliationStatus: 'UNMATCHED',
        })
        balance = closeTarget
      }

      statements.push({
        startDate,
        endDate,
        openingBalance: openBal,
        closingBalance: closeTarget,
        lines,
      })
    }
  }

  return statements
}

// ─── Budget Data ──────────────────────────────────────────────────

interface BudgetAccountEntry {
  accountNumber: string
  monthlyAmounts: number[] // Jan–Dec
}

function buildBudgets(): { year: number; entries: BudgetAccountEntry[]; name: string }[] {
  return YEAR_PARAMS.map((yp) => {
    const baseRevenue = Math.round(yp.quarterlyRevenue[0] / 3)
    return {
      year: yp.year,
      name: `Budget ${yp.year} – Nordisk Erhverv ApS`,
      entries: [
        {
          accountNumber: '4100',
          monthlyAmounts: Array.from({ length: 12 }, (_, i) =>
            Math.round(baseRevenue * (0.7 + seededRandom(yp.year * 10 + i) * 0.6) / 100) * 100
          ),
        },
        { accountNumber: '7000', monthlyAmounts: Array(12).fill(yp.salaryGross) },
        { accountNumber: '7100', monthlyAmounts: Array(12).fill(Math.round(yp.salaryGross * yp.employerPct / 100) * 100) },
        { accountNumber: '7200', monthlyAmounts: Array(12).fill(Math.round(yp.salaryGross * yp.pensionPct / 100) * 100) },
        { accountNumber: '8000', monthlyAmounts: Array(12).fill(yp.rentNet) },
        { accountNumber: '8400', monthlyAmounts: [yp.insuranceQ, 0, 0, yp.insuranceQ, 0, 0, yp.insuranceQ, 0, 0, yp.insuranceQ, 0, 0] },
        { accountNumber: '8600', monthlyAmounts: Array(12).fill(yp.telecomNet) },
        { accountNumber: '8700', monthlyAmounts: Array(12).fill(3000 + Math.round(yp.rentNet * 0.05)) },
        { accountNumber: '8800', monthlyAmounts: Array.from({ length: 12 }, (_, i) => Math.round((3000 + yp.year * 200 + i * 200) / 100) * 100) },
        { accountNumber: '8900', monthlyAmounts: [0, 0, yp.depreciationQ, 0, 0, yp.depreciationQ, 0, 0, yp.depreciationQ, 0, 0, yp.depreciationQ] },
        { accountNumber: '9100', monthlyAmounts: Array.from({ length: 12 }, (_, i) => i === 5 || i === 11 ? 1500 : 0) },
      ],
    }
  })
}

// ─── Main Seed Function ──────────────────────────────────────────

export async function seedDemoCompany(demoCompanyId: string, systemUserId: string): Promise<void> {
  // ─── Idempotency check ─────────────────────────────────────────
  const existingContacts = await db.contact.count({
    where: { companyId: demoCompanyId, isDemo: true },
  })
  if (existingContacts > 0) {
    console.log('[seed-demo-company] Demo data already exists for company', demoCompanyId, '– skipping')
    return
  }

  console.log('[seed-demo-company] Seeding demo data for company', demoCompanyId)

  // ─── 1. Chart of Accounts ──────────────────────────────────────
  const accountsCreated = await seedChartOfAccounts(systemUserId, demoCompanyId, true)
  console.log(`[seed-demo-company] Created ${accountsCreated} accounts`)

  // Build account number → ID map
  const accounts = await db.account.findMany({ where: { companyId: demoCompanyId, isDemo: true } })
  const accountMap = new Map<string, string>()
  for (const a of accounts) {
    accountMap.set(a.number, a.id)
  }
  const ac = (number: string): string => {
    const id = accountMap.get(number)
    if (!id) throw new Error(`Account ${number} not found in demo company`)
    return id
  }

  // ─── 2. Contacts ──────────────────────────────────────────────
  console.log('[seed-demo-company] Creating contacts...')
  const contactIds: string[] = []
  for (const c of CONTACT_DATA) {
    const contact = await db.contact.create({
      data: {
        name: c.name,
        cvrNumber: c.cvrNumber,
        email: c.email,
        phone: c.phone,
        address: c.address,
        city: c.city,
        postalCode: c.postalCode,
        country: 'Danmark',
        type: c.type,
        notes: c.notes,
        isActive: true,
        isDemo: true,
        userId: systemUserId,
        companyId: demoCompanyId,
      },
    })
    contactIds.push(contact.id)
  }
  console.log(`[seed-demo-company] Created ${contactIds.length} contacts`)

  // ─── 3. Invoices ──────────────────────────────────────────────
  console.log('[seed-demo-company] Creating invoices...')
  const invoiceSeeds = buildInvoices()
  const invoiceIds: string[] = []
  for (const inv of invoiceSeeds) {
    const subtotal = inv.lineItems.reduce((sum, li) => sum + r(li.quantity * li.unitPrice), 0)
    const vatTotal = inv.lineItems.reduce((sum, li) => sum + r(li.quantity * li.unitPrice * li.vatPercent / 100), 0)
    const total = r(subtotal + vatTotal)

    const contact = CONTACT_DATA[inv.contactIndex]

    const invoice = await db.invoice.create({
      data: {
        invoiceNumber: inv.invoiceNumber,
        customerName: contact.name,
        customerAddress: `${contact.address}, ${contact.postalCode} ${contact.city}`,
        customerEmail: contact.email,
        customerPhone: contact.phone,
        customerCvr: contact.cvrNumber,
        issueDate: inv.issueDate,
        dueDate: inv.dueDate,
        lineItems: JSON.stringify(inv.lineItems),
        subtotal,
        vatTotal,
        total,
        currency: 'DKK',
        status: inv.status,
        notes: inv.notes ?? null,
        cancelled: inv.cancelled ?? false,
        cancelReason: inv.cancelReason ?? null,
        contactId: contactIds[inv.contactIndex],
        isDemo: true,
        userId: systemUserId,
        companyId: demoCompanyId,
      },
    })
    invoiceIds.push(invoice.id)
  }
  console.log(`[seed-demo-company] Created ${invoiceIds.length} invoices`)

  // ─── 4. Transactions ──────────────────────────────────────────
  console.log('[seed-demo-company] Creating transactions...')
  const transactionSeeds = buildTransactions()
  const transactionData = transactionSeeds.map((t) => ({
    date: t.date,
    type: t.type,
    amount: Math.abs(t.amount),
    currency: 'DKK',
    description: t.description,
    vatPercent: t.vatPercent,
    isDemo: true,
    userId: systemUserId,
    companyId: demoCompanyId,
    invoiceId: t.contactIndex !== undefined ? invoiceIds[t.contactIndex] ?? null : null,
  }))
  const txResult = await db.transaction.createMany({ data: transactionData as any })
  console.log(`[seed-demo-company] Created ${txResult.count} transactions`)

  // ─── 5. Journal Entries ───────────────────────────────────────
  console.log('[seed-demo-company] Creating journal entries...')
  const jeSeeds = buildJournalEntries()

  // Validate all entries balance before creating
  for (let i = 0; i < jeSeeds.length; i++) {
    const je = jeSeeds[i]
    const totalDebit = je.lines.reduce((s, l) => s + l.debit, 0)
    const totalCredit = je.lines.reduce((s, l) => s + l.credit, 0)
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(
        `Journal entry #${i + 1} "${je.description}" is NOT balanced: debit=${totalDebit}, credit=${totalCredit}, diff=${r(totalDebit - totalCredit)}`
      )
    }
  }

  let jeCount = 0
  for (const je of jeSeeds) {
    await db.journalEntry.create({
      data: {
        date: je.date,
        description: je.description,
        reference: je.reference ?? null,
        status: je.status,
        cancelled: false,
        isDemo: true,
        userId: systemUserId,
        companyId: demoCompanyId,
        lines: {
          create: je.lines.map((l) => ({
            accountId: ac(l.accountNumber),
            debit: l.debit,
            credit: l.credit,
            vatCode: l.vatCode ?? null,
            description: l.description ?? null,
          })),
        },
      },
    })
    jeCount++
  }
  console.log(`[seed-demo-company] Created ${jeCount} journal entries`)

  // ─── 6. Fiscal Periods ────────────────────────────────────────
  console.log('[seed-demo-company] Creating fiscal periods...')
  const fiscalPeriodData: { year: number; month: number; status: PeriodStatus; lockedAt: Date | null; lockedBy: string | null; isDemo: boolean; userId: string; companyId: string }[] = []

  for (let yi = 0; yi < 3; yi++) {
    const year = YEAR_PARAMS[yi].year
    const isCurrentYear = year === YEAR_3
    const maxMonth = isCurrentYear ? Math.min(CURRENT_MONTH, 12) : 12

    for (let m = 1; m <= maxMonth; m++) {
      // Earlier years: all CLOSED. Current year: past months CLOSED, current month OPEN
      let status: PeriodStatus
      if (!isCurrentYear) {
        status = 'CLOSED'
      } else if (m < CURRENT_MONTH) {
        status = 'CLOSED'
      } else {
        status = 'OPEN'
      }

      const lockedAt = status === 'CLOSED' ? d(year, m, lastDayOfMonth(year, m)) : null
      fiscalPeriodData.push({
        year,
        month: m,
        status,
        lockedAt,
        lockedBy: status === 'CLOSED' ? systemUserId : null,
        isDemo: true,
        userId: systemUserId,
        companyId: demoCompanyId,
      })
    }
  }

  const fpResult = await db.fiscalPeriod.createMany({ data: fiscalPeriodData })
  console.log(`[seed-demo-company] Created ${fpResult.count} fiscal periods`)

  // ─── 7. Bank Connection ───────────────────────────────────────
  console.log('[seed-demo-company] Creating bank connection...')
  const bankConnection = await db.bankConnection.create({
    data: {
      bankName: 'Nordea',
      provider: 'Nordigen',
      registrationNumber: '1234',
      accountNumber: '567890',
      iban: 'DK50 1234 5678 9012 3456',
      accountName: 'Nordisk Erhverv ApS – Erhvervskonto',
      currentBalance: 1800000,
      lastSyncAt: NOW,
      nextSyncAt: addDays(NOW, 1),
      syncFrequency: 'daily',
      status: 'ACTIVE',
      isDemo: true,
      userId: systemUserId,
      companyId: demoCompanyId,
    },
  })
  console.log(`[seed-demo-company] Created bank connection: ${bankConnection.id}`)

  // ─── 8. Bank Statements ───────────────────────────────────────
  console.log('[seed-demo-company] Creating bank statements...')
  const statementSeeds = buildBankStatements()
  let stmtCount = 0
  let stmtLineCount = 0
  for (const ss of statementSeeds) {
    const stmt = await db.bankStatement.create({
      data: {
        bankAccount: '1234 567890',
        startDate: ss.startDate,
        endDate: ss.endDate,
        openingBalance: ss.openingBalance,
        closingBalance: ss.closingBalance,
        fileName: `Nordea_Kontoudskrift_${ss.startDate.toISOString().slice(0, 10)}_${ss.endDate.toISOString().slice(0, 10)}.csv`,
        importDate: new Date(Math.min(NOW.getTime(), ss.endDate.getTime())),
        importSource: 'CSV_UPLOAD',
        reconciled: ss.lines.every((l) => l.reconciliationStatus === 'MATCHED'),
        reconciledAt: ss.lines.every((l) => l.reconciliationStatus === 'MATCHED')
          ? new Date(Math.min(NOW.getTime(), ss.endDate.getTime()))
          : null,
        isDemo: true,
        userId: systemUserId,
        companyId: demoCompanyId,
        bankConnectionId: bankConnection.id,
        lines: {
          create: ss.lines.map((l) => ({
            date: l.date,
            description: l.description,
            reference: l.reference,
            amount: l.amount,
            balance: l.balance,
            reconciliationStatus: l.reconciliationStatus,
            matchedAt: l.reconciliationStatus === 'MATCHED' ? l.date : null,
            matchConfidence: l.reconciliationStatus === 'AI_SUGGESTED' ? 0.92 : l.reconciliationStatus === 'MATCHED' ? 1.0 : null,
            matchMethod: l.reconciliationStatus === 'AI_SUGGESTED' ? 'AI' : l.reconciliationStatus === 'MATCHED' ? 'AUTO' : null,
          })),
        },
      },
    })
    stmtCount++
    stmtLineCount += ss.lines.length
  }
  console.log(`[seed-demo-company] Created ${stmtCount} bank statements with ${stmtLineCount} lines`)

  // ─── 9. Budgets ───────────────────────────────────────────────
  console.log('[seed-demo-company] Creating budgets...')
  const budgetData = buildBudgets()

  for (const bd of budgetData) {
    const budget = await db.budget.create({
      data: {
        name: bd.name,
        year: bd.year,
        notes: 'Årligt budget for IT-konsulentvirksomhed – justeret for vækst',
        isActive: true,
        isDemo: true,
        userId: systemUserId,
        companyId: demoCompanyId,
      },
    })

    const budgetEntryData = bd.entries.map((be) => ({
      budgetId: budget.id,
      accountId: ac(be.accountNumber),
      january: be.monthlyAmounts[0],
      february: be.monthlyAmounts[1],
      march: be.monthlyAmounts[2],
      april: be.monthlyAmounts[3],
      may: be.monthlyAmounts[4],
      june: be.monthlyAmounts[5],
      july: be.monthlyAmounts[6],
      august: be.monthlyAmounts[7],
      september: be.monthlyAmounts[8],
      october: be.monthlyAmounts[9],
      november: be.monthlyAmounts[10],
      december: be.monthlyAmounts[11],
    }))
    await db.budgetEntry.createMany({ data: budgetEntryData })
    console.log(`[seed-demo-company] Created budget ${bd.year} with ${budgetEntryData.length} account entries`)
  }

  // ─── 10. Recurring Entries ────────────────────────────────────
  console.log('[seed-demo-company] Creating recurring entries...')

  // 10a. Monthly rent
  await db.recurringEntry.create({
    data: {
      name: 'Månedlig husleje – Vesterbrogade 42',
      description: 'Husleje for kontorlokaler på Vesterbrogade 42, København V. Betaling den 1. i måneden.',
      frequency: 'MONTHLY',
      status: 'ACTIVE',
      startDate: d(YEAR_1, 1, 1),
      endDate: d(YEAR_3, 12, 31),
      nextExecution: d(YEAR_3, CURRENT_MONTH + 1 > 12 ? 1 : CURRENT_MONTH + 1, 1),
      lastExecuted: d(YEAR_3, CURRENT_MONTH, 1),
      lines: JSON.stringify([
        { accountNumber: '8000', debit: 20000, credit: 0, vatCode: 'K25', description: 'Husleje ekskl. moms' },
        { accountNumber: '5410', debit: 5000, credit: 0, vatCode: 'NONE', description: 'Indgående moms 25%' },
        { accountNumber: '1100', debit: 0, credit: 25000, vatCode: 'NONE', description: 'Betaling fra bankkonto' },
      ]),
      reference: 'LEJE-REC',
      isDemo: true,
      userId: systemUserId,
      companyId: demoCompanyId,
    },
  })

  // 10b. Quarterly insurance
  await db.recurringEntry.create({
    data: {
      name: 'Kvartalsvis erhvervsforsikring – Nordisk Forsikring A/S',
      description: 'Erhvervsansvars- og indboforsikring. Betaling kvartalsvis den 10. i måneden.',
      frequency: 'QUARTERLY',
      status: 'ACTIVE',
      startDate: d(YEAR_1, 1, 10),
      endDate: d(YEAR_3, 12, 31),
      nextExecution: d(YEAR_3, Math.ceil(CURRENT_MONTH / 3) * 3 + 1 > 12 ? 1 : Math.ceil(CURRENT_MONTH / 3) * 3 + 1, 10),
      lastExecuted: d(YEAR_3, Math.ceil(CURRENT_MONTH / 3) * 3, 10),
      lines: JSON.stringify([
        { accountNumber: '8400', debit: 16000, credit: 0, vatCode: 'K0', description: 'Forsikringspræmie (momsfri)' },
        { accountNumber: '1100', debit: 0, credit: 16000, vatCode: 'NONE', description: 'Betaling fra bankkonto' },
      ]),
      reference: 'FOR-REC',
      isDemo: true,
      userId: systemUserId,
      companyId: demoCompanyId,
    },
  })

  // 10c. Monthly IT support
  await db.recurringEntry.create({
    data: {
      name: 'Månedlig IT-support – ekstern konsulentbistand',
      description: 'Løbende IT-support og vedligeholdelse af systemer. Faktureres månedligt.',
      frequency: 'MONTHLY',
      status: 'ACTIVE',
      startDate: d(YEAR_1, 1, 1),
      endDate: d(YEAR_3, 12, 31),
      nextExecution: d(YEAR_3, CURRENT_MONTH + 1 > 12 ? 1 : CURRENT_MONTH + 1, 5),
      lastExecuted: d(YEAR_3, CURRENT_MONTH, 5),
      lines: JSON.stringify([
        { accountNumber: '8600', debit: 6400, credit: 0, vatCode: 'K25', description: 'IT-support ekskl. moms' },
        { accountNumber: '5410', debit: 1600, credit: 0, vatCode: 'NONE', description: 'Indgående moms 25%' },
        { accountNumber: '1100', debit: 0, credit: 8000, vatCode: 'NONE', description: 'Betaling fra bankkonto' },
      ]),
      reference: 'ITSUPP-REC',
      isDemo: true,
      userId: systemUserId,
      companyId: demoCompanyId,
    },
  })

  console.log('[seed-demo-company] Created 3 recurring entries')
  console.log('[seed-demo-company] ✅ Demo company seeding complete!')
}
