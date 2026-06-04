import { supabase } from "@/integrations/supabase/client";

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (d: number) =>
  new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
const daysAhead = (d: number) =>
  new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);

export async function seedDemoData(userId: string) {
  // Customers
  const { data: customers } = await supabase
    .from("customers")
    .insert([
      { user_id: userId, name: "Acme Industries", email: "ops@acme.com", phone: "+1 555 0101", company: "Acme Industries", status: "customer", notes: "Repeat client — net 30" },
      { user_id: userId, name: "Globex Corp", email: "hello@globex.com", phone: "+1 555 0144", company: "Globex Corp", status: "customer", notes: "Strategic account" },
      { user_id: userId, name: "Initech Ltd", email: "billing@initech.com", phone: "+1 555 0188", company: "Initech", status: "lead", notes: "Pilot Q3" },
      { user_id: userId, name: "Umbrella LLC", email: "po@umbrella.co", phone: "+1 555 0123", company: "Umbrella", status: "customer" },
      { user_id: userId, name: "Stark Manufacturing", email: "ap@stark.io", phone: "+1 555 0177", company: "Stark Mfg.", status: "lead" },
      { user_id: userId, name: "Wayne Foods", email: "orders@waynefoods.com", phone: "+1 555 0166", company: "Wayne Foods", status: "customer" },
    ])
    .select("id, name");

  // Suppliers
  await supabase.from("suppliers").insert([
    { user_id: userId, name: "Northwind Traders", contact_name: "Anna Miles", email: "anna@northwind.com", phone: "+1 555 9001", address: "120 Pine Ave, Seattle WA" },
    { user_id: userId, name: "Pacific Components", contact_name: "Hugo Park", email: "hugo@pacificco.com", phone: "+1 555 9008", address: "44 Bay Rd, San Diego CA" },
    { user_id: userId, name: "EuroParts GmbH", contact_name: "Lena Vogt", email: "lena@europarts.de", phone: "+49 30 9000111", address: "Berlin, DE" },
  ]);

  // Products
  const { data: products } = await supabase
    .from("products")
    .insert([
      { user_id: userId, name: "Wireless Headphones Pro", sku: "WH-PRO-01", category: "Electronics", price: 249, cost: 110, stock: 48, low_stock_threshold: 10 },
      { user_id: userId, name: "Smart Watch Series 7", sku: "SW-07", category: "Electronics", price: 329, cost: 180, stock: 22, low_stock_threshold: 8 },
      { user_id: userId, name: "Mechanical Keyboard", sku: "KB-MX-01", category: "Accessories", price: 149, cost: 70, stock: 65, low_stock_threshold: 12 },
      { user_id: userId, name: "Ergonomic Mouse", sku: "MS-ER-02", category: "Accessories", price: 79, cost: 30, stock: 110, low_stock_threshold: 15 },
      { user_id: userId, name: "4K Webcam", sku: "CAM-4K", category: "Electronics", price: 199, cost: 95, stock: 4, low_stock_threshold: 5 },
      { user_id: userId, name: "USB-C Hub 8-in-1", sku: "HUB-8", category: "Accessories", price: 59, cost: 22, stock: 88, low_stock_threshold: 20 },
      { user_id: userId, name: "Office Chair Ergo", sku: "CH-ERG", category: "Furniture", price: 449, cost: 220, stock: 14, low_stock_threshold: 5 },
      { user_id: userId, name: "Standing Desk 60\"", sku: "DSK-60", category: "Furniture", price: 599, cost: 310, stock: 9, low_stock_threshold: 4 },
      { user_id: userId, name: "Noise Cancel Earbuds", sku: "EB-NC", category: "Electronics", price: 179, cost: 80, stock: 70, low_stock_threshold: 15 },
      { user_id: userId, name: "Portable SSD 1TB", sku: "SSD-1T", category: "Storage", price: 139, cost: 65, stock: 33, low_stock_threshold: 10 },
    ])
    .select("id, name, price");

  // Employees
  await supabase.from("employees").insert([
    { user_id: userId, full_name: "Sarah Chen", email: "sarah@nexus.co", position: "CEO", department: "Executive", salary: 180000, hire_date: "2022-01-15", status: "active" },
    { user_id: userId, full_name: "Marcus Wright", email: "marcus@nexus.co", position: "CTO", department: "Engineering", salary: 165000, hire_date: "2022-02-01", status: "active" },
    { user_id: userId, full_name: "Aisha Patel", email: "aisha@nexus.co", position: "Head of Sales", department: "Sales", salary: 130000, hire_date: "2022-04-10", status: "active" },
    { user_id: userId, full_name: "Diego Ruiz", email: "diego@nexus.co", position: "Senior Engineer", department: "Engineering", salary: 145000, hire_date: "2023-03-22", status: "active" },
    { user_id: userId, full_name: "Emma Schultz", email: "emma@nexus.co", position: "Designer", department: "Product", salary: 110000, hire_date: "2023-06-01", status: "active" },
    { user_id: userId, full_name: "Liam O'Connor", email: "liam@nexus.co", position: "Accountant", department: "Finance", salary: 95000, hire_date: "2023-09-12", status: "active" },
    { user_id: userId, full_name: "Yuki Tanaka", email: "yuki@nexus.co", position: "HR Manager", department: "HR", salary: 105000, hire_date: "2022-11-05", status: "active" },
    { user_id: userId, full_name: "Noah Becker", email: "noah@nexus.co", position: "Support Lead", department: "Support", salary: 85000, hire_date: "2024-02-19", status: "active" },
  ]);

  // Departments
  await supabase.from("departments").insert([
    { user_id: userId, name: "Engineering", manager: "Marcus Wright", description: "Builds and runs the platform." },
    { user_id: userId, name: "Sales", manager: "Aisha Patel", description: "Revenue & accounts." },
    { user_id: userId, name: "Finance", manager: "Liam O'Connor", description: "Accounting & FP&A." },
    { user_id: userId, name: "HR", manager: "Yuki Tanaka", description: "People operations." },
    { user_id: userId, name: "Product", manager: "Emma Schultz", description: "UX, research, design." },
    { user_id: userId, name: "Support", manager: "Noah Becker", description: "Customer support." },
  ]);

  // Invoices linked to customers
  if (customers?.length) {
    const inv = customers.slice(0, 5).map((c, i) => ({
      user_id: userId,
      customer_id: c.id,
      invoice_number: `INV-2026-${String(1001 + i).padStart(4, "0")}`,
      amount: [2450, 5800, 1290, 9750, 3300][i],
      tax: [245, 580, 129, 975, 330][i],
      status: ["paid", "paid", "sent", "overdue", "paid"][i],
      issue_date: daysAgo([45, 30, 14, 60, 7][i]),
      due_date: daysAhead([0, 5, 20, -15, 25][i]),
      notes: `Services rendered for ${c.name}`,
    }));
    const { data: invoices } = await supabase.from("invoices").insert(inv).select("id, amount, status");
    // Payments for paid invoices
    if (invoices?.length) {
      await supabase.from("payments").insert(
        invoices
          .filter((i) => i.status === "paid")
          .map((i) => ({
            user_id: userId,
            invoice_id: i.id,
            amount: i.amount,
            method: "bank_transfer",
            reference: `TXN-${Math.floor(Math.random() * 90000 + 10000)}`,
            payment_date: today(),
            notes: "Auto-recorded",
          })),
      );
    }
  }

  // Expenses
  await supabase.from("expenses").insert([
    { user_id: userId, category: "SaaS", vendor: "Linear", amount: 480, date: daysAgo(30), description: "Annual team plan" },
    { user_id: userId, category: "Travel", vendor: "Delta", amount: 1240, date: daysAgo(20), description: "Client visit — NYC" },
    { user_id: userId, category: "Office", vendor: "WeWork", amount: 3200, date: daysAgo(5), description: "Monthly coworking" },
    { user_id: userId, category: "Marketing", vendor: "Google Ads", amount: 2100, date: daysAgo(12), description: "Q2 campaign" },
    { user_id: userId, category: "Hardware", vendor: "Apple", amount: 4900, date: daysAgo(45), description: "Two MacBook Pros" },
    { user_id: userId, category: "Utilities", vendor: "ConEd", amount: 320, date: daysAgo(8), description: "Electric bill" },
  ]);

  // Projects
  const { data: projects } = await supabase
    .from("projects")
    .insert([
      { user_id: userId, name: "Website Redesign", client: "Acme Industries", status: "in_progress", budget: 45000, start_date: daysAgo(20), end_date: daysAhead(40), description: "Marketing site overhaul" },
      { user_id: userId, name: "Mobile App v2", client: "Globex Corp", status: "planning", budget: 120000, start_date: daysAhead(10), end_date: daysAhead(120), description: "Native iOS + Android" },
      { user_id: userId, name: "Inventory Migration", client: "Wayne Foods", status: "completed", budget: 28000, start_date: daysAgo(90), end_date: daysAgo(10) },
    ])
    .select("id, name");

  // Tasks
  if (projects?.length) {
    await supabase.from("tasks").insert([
      { user_id: userId, project_id: projects[0].id, title: "Design new homepage hero", assignee: "Emma Schultz", priority: "high", status: "in_progress", due_date: daysAhead(5) },
      { user_id: userId, project_id: projects[0].id, title: "Wire CMS to Next.js", assignee: "Diego Ruiz", priority: "medium", status: "todo", due_date: daysAhead(14) },
      { user_id: userId, project_id: projects[1].id, title: "Define MVP scope", assignee: "Sarah Chen", priority: "urgent", status: "todo", due_date: daysAhead(3) },
      { user_id: userId, project_id: projects[1].id, title: "Set up CI/CD", assignee: "Marcus Wright", priority: "medium", status: "todo", due_date: daysAhead(20) },
      { user_id: userId, title: "Quarterly all-hands prep", assignee: "Yuki Tanaka", priority: "low", status: "done", due_date: daysAgo(2) },
    ]);
  }

  // Quotes
  if (customers?.length) {
    await supabase.from("quotes").insert([
      { user_id: userId, customer_id: customers[2].id, quote_number: "Q-2026-0042", amount: 15800, tax: 1580, status: "sent", valid_until: daysAhead(30), notes: "Pilot package" },
      { user_id: userId, customer_id: customers[4].id, quote_number: "Q-2026-0043", amount: 8700, tax: 870, status: "draft", valid_until: daysAhead(15) },
      { user_id: userId, customer_id: customers[1].id, quote_number: "Q-2026-0044", amount: 42000, tax: 4200, status: "accepted", valid_until: daysAhead(60) },
    ]);
  }

  // Leave requests
  await supabase.from("leave_requests").insert([
    { user_id: userId, leave_type: "vacation", start_date: daysAhead(14), end_date: daysAhead(21), status: "approved", reason: "Family trip" },
    { user_id: userId, leave_type: "sick", start_date: daysAgo(2), end_date: daysAgo(1), status: "approved", reason: "Flu" },
    { user_id: userId, leave_type: "personal", start_date: daysAhead(7), end_date: daysAhead(7), status: "pending", reason: "Appointment" },
  ]);

  // Stock movements
  if (products?.length) {
    await supabase.from("stock_movements").insert([
      { user_id: userId, product_id: products[0].id, movement_type: "in", quantity: 50, reference: "PO-001", notes: "Restock" },
      { user_id: userId, product_id: products[4].id, movement_type: "out", quantity: 6, reference: "Sale", notes: "Online order" },
      { user_id: userId, product_id: products[2].id, movement_type: "in", quantity: 30, reference: "PO-002" },
    ]);
  }

  // Meetings
  await supabase.from("meetings").insert([
    { user_id: userId, title: "Weekly product sync", description: "Roadmap review", start_time: new Date(Date.now() + 86400000).toISOString(), end_time: new Date(Date.now() + 86400000 + 3600000).toISOString(), location: "Zoom", attendees: "Sarah, Marcus, Emma" },
    { user_id: userId, title: "Client kickoff — Acme", start_time: new Date(Date.now() + 3 * 86400000).toISOString(), end_time: new Date(Date.now() + 3 * 86400000 + 3600000).toISOString(), location: "Acme HQ", attendees: "Aisha, Sarah" },
    { user_id: userId, title: "Q2 board meeting", start_time: new Date(Date.now() + 10 * 86400000).toISOString(), end_time: new Date(Date.now() + 10 * 86400000 + 7200000).toISOString(), location: "Boardroom", attendees: "Board" },
  ]);

  // Assets
  await supabase.from("assets").insert([
    { user_id: userId, name: "MacBook Pro 16\"", asset_tag: "LAP-001", category: "Laptop", location: "Engineering", status: "assigned", value: 3499, purchase_date: daysAgo(120) },
    { user_id: userId, name: "Dell Monitor 32\"", asset_tag: "MON-014", category: "Display", location: "Design pod", status: "assigned", value: 899, purchase_date: daysAgo(200) },
    { user_id: userId, name: "Conference Camera", asset_tag: "AV-003", category: "AV", location: "Boardroom", status: "available", value: 1200, purchase_date: daysAgo(360) },
    { user_id: userId, name: "Espresso Machine", asset_tag: "OFC-007", category: "Office", location: "Kitchen", status: "maintenance", value: 1800, purchase_date: daysAgo(500) },
  ]);

  // Tickets
  if (customers?.length) {
    await supabase.from("tickets").insert([
      { user_id: userId, customer_id: customers[0].id, subject: "Login fails after password reset", priority: "high", status: "open", assignee: "Noah Becker", description: "User gets 401 after reset" },
      { user_id: userId, customer_id: customers[1].id, subject: "Invoice PDF missing logo", priority: "low", status: "in_progress", assignee: "Noah Becker" },
      { user_id: userId, customer_id: customers[3].id, subject: "Bulk import failing on CSV", priority: "urgent", status: "open", assignee: "Diego Ruiz" },
      { user_id: userId, customer_id: customers[5].id, subject: "Feature request: tax presets", priority: "medium", status: "open" },
    ]);
  }

  // Contracts
  await supabase.from("contracts").insert([
    { user_id: userId, title: "MSA — Acme Industries", party: "Acme Industries", contract_type: "service", value: 240000, status: "active", start_date: daysAgo(180), end_date: daysAhead(180) },
    { user_id: userId, title: "NDA — Globex", party: "Globex Corp", contract_type: "nda", value: 0, status: "active", start_date: daysAgo(60), end_date: daysAhead(700) },
    { user_id: userId, title: "Employment — Diego Ruiz", party: "Diego Ruiz", contract_type: "employment", value: 145000, status: "active", start_date: daysAgo(400), end_date: null },
  ]);

  // Announcements
  await supabase.from("announcements").insert([
    { user_id: userId, title: "Welcome to Nexus ERP 🎉", body: "We've migrated to the new platform. Explore the modules from the sidebar.", audience: "all", pinned: true },
    { user_id: userId, title: "Q2 Kickoff — Friday 10am", body: "All-hands in the main boardroom + Zoom.", audience: "all", pinned: false },
    { user_id: userId, title: "New medical benefits", body: "Updated provider list available in HR.", audience: "all", pinned: false },
  ]);

  // Purchase orders
  await supabase.from("purchase_orders").insert([
    { user_id: userId, po_number: "PO-2026-0001", status: "received", total: 12400, order_date: daysAgo(30), expected_date: daysAgo(15) },
    { user_id: userId, po_number: "PO-2026-0002", status: "sent", total: 5600, order_date: daysAgo(8), expected_date: daysAhead(7) },
    { user_id: userId, po_number: "PO-2026-0003", status: "draft", total: 21800, order_date: today(), expected_date: daysAhead(14) },
  ]);
}
