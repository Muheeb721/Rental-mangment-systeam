import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { LuPlus } from 'react-icons/lu';
import PageHeader from '../components/site/PageHeader';
import Reveal from '../components/site/Reveal';

const GROUPS = [
  {
    title: 'Renting a property',
    items: [
      ['Are the listings on RMS verified?', 'Yes. Every property is reviewed by our leasing team — ownership, price and photos — before it is published. If something looks wrong, use “Report a listing” in the footer.'],
      ['How do I book a visit?', 'Open any listing and choose “Book a visit”. Pick a date and time slot; an agent will call you to confirm the viewing.'],
      ['What do I need to apply?', 'A free RMS account, your CNIC number, a contact number and your preferred move-in date. You can track the status of your application from your dashboard.'],
      ['How much is the security deposit?', 'It depends on the property and is shown in the cost breakdown on each listing. In Lahore it is commonly one to two months’ rent.'],
    ],
  },
  {
    title: 'Payments & tenancy',
    items: [
      ['How do I pay rent?', 'Pay by bank transfer, JazzCash, Easypaisa, cheque or cash, then submit the transaction reference under Dashboard → Rent & payments. Our accounts team verifies it, usually within one working day.'],
      ['How do I report a maintenance problem?', 'Go to Dashboard → Maintenance and create a request with a category and priority. You will be notified as it progresses.'],
      ['Where can I find my rental agreement?', 'Once your application is accepted, the agreement can be downloaded from Dashboard → Applications or from the notification you receive.'],
    ],
  },
  {
    title: 'Property owners',
    items: [
      ['How do I list my property?', 'Send us your details through the contact form (choose “I want to list my property”) and our team will arrange a visit and photographs.'],
      ['Do you screen tenants?', 'Yes. Applicants submit CNIC and contact details and you approve the final tenant.'],
    ],
  },
];

function Item({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`faq-item ${open ? 'is-open' : ''}`}>
      <button type="button" className="faq-q" onClick={() => setOpen((o) => !o)} aria-expanded={open}>{q}<LuPlus size={20} /></button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div className="faq-a" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
            <p>{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FAQPage() {
  return (
    <>
      <PageHeader eyebrow="Help centre" title="Frequently asked questions" crumbs={['FAQs']}>
        Quick answers about renting, payments and listing your property with RMS.
      </PageHeader>
      <section className="r-section">
        <div className="r-container" style={{ maxWidth: 880, display: 'grid', gap: 48 }}>
          {GROUPS.map((g) => (
            <Reveal key={g.title}>
              <h2 style={{ fontSize: 22, marginBottom: 6 }}>{g.title}</h2>
              {g.items.map(([q, a]) => <Item key={q} q={q} a={a} />)}
            </Reveal>
          ))}
          <div className="h-cta-lite">
            <div><h3 style={{ fontSize: 19 }}>Still have a question?</h3><p className="r-muted">Our team usually replies within one working day.</p></div>
            <Link to="/contact" className="r-btn r-btn--primary">Contact us</Link>
          </div>
        </div>
      </section>
    </>
  );
}
