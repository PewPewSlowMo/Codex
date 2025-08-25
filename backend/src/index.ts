import express from 'express';

interface DictionaryEntry {
  id: number;
  name: string;
}

interface Call {
  id: number;
  uniqueid?: string;
  linkedid?: string;
  queue?: string;
  direction: 'inbound' | 'outbound';
  status:
    | 'ringing'
    | 'answered'
    | 'missed'
    | 'abandoned'
    | 'busy'
    | 'failed';
  started_at: string;
  answered_at?: string;
  ended_at?: string;
  duration_sec?: number;
  talk_sec?: number;
  hold_sec?: number;
  src_number: string;
  dst_number: string;
  did?: string;
  operator_id?: number;
  purpose_id?: number;
  category_id?: number;
  sub_category_id?: number;
  recording_path?: string;
  recording_url?: string;
  resolved_first_call?: boolean;
  needs_callback?: boolean;
  notes?: string;
}

interface User {
  id: number;
  name: string;
  role: 'operator' | 'supervisor' | 'admin';
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

const purposes: DictionaryEntry[] = [
  { id: 1, name: 'Запись на приём' },
  { id: 2, name: 'Перенос/отмена визита' },
  { id: 3, name: 'Консультация по услугам' },
  { id: 4, name: 'Жалоба/претензия' },
  { id: 5, name: 'Уточнение расписания' },
  { id: 6, name: 'Вопрос по результатам анализов' },
  { id: 7, name: 'Финансовые вопросы' },
  { id: 8, name: 'Вопрос по страхованию' },
  { id: 9, name: 'Техническая помощь' },
  { id: 10, name: 'Прочее' }
];

const categories: DictionaryEntry[] = [
  { id: 1, name: 'Медицинские услуги' },
  { id: 2, name: 'Лаборатория/анализы' },
  { id: 3, name: 'Расписание/приём' },
  { id: 4, name: 'Финансы/страхование' },
  { id: 5, name: 'Жалобы и предложения' },
  { id: 6, name: 'Технические вопросы' },
  { id: 7, name: 'Прочее' }
];

const subcategories: DictionaryEntry[] = [];
const tags: DictionaryEntry[] = [];

const users: User[] = [
  { id: 1, name: 'Operator One', role: 'operator' },
  { id: 2, name: 'Supervisor Sue', role: 'supervisor' },
  { id: 3, name: 'Admin Adam', role: 'admin' }
];

const app = express();
app.use(express.json());

app.use((req, _res, next) => {
  const userId = req.header('x-user-id');
  if (userId) {
    req.user = users.find((u) => u.id === Number(userId));
  }
  next();
});

const calls: Call[] = [];
let nextCallId = 1;

app.get('/calls', (req, res) => {
  let result = calls;
  const {
    operator_id,
    status,
    purpose_id,
    category_id,
    from,
    to
  } = req.query;

  if (operator_id) {
    const id = Number(operator_id);
    result = result.filter((c) => c.operator_id === id);
  }
  if (status) {
    result = result.filter((c) => c.status === status);
  }
  if (purpose_id) {
    const id = Number(purpose_id);
    result = result.filter((c) => c.purpose_id === id);
  }
  if (category_id) {
    const id = Number(category_id);
    result = result.filter((c) => c.category_id === id);
  }
  if (from) {
    const fromDate = new Date(from.toString());
    result = result.filter((c) => new Date(c.started_at) >= fromDate);
  }
  if (to) {
    const toDate = new Date(to.toString());
    result = result.filter((c) => new Date(c.started_at) <= toDate);
  }

  res.json(result);
});

app.post('/calls', (req, res) => {
  const body = req.body as Partial<Call>;
  const call: Call = {
    id: nextCallId++,
    direction: body.direction || 'inbound',
    status: body.status || 'ringing',
    src_number: body.src_number || '',
    dst_number: body.dst_number || '',
    started_at: new Date().toISOString()
  };
  calls.push(call);
  res.status(201).json(call);
});

app.put('/calls/:id', (req, res) => {
  const call = calls.find((c) => c.id === Number(req.params.id));
  if (!call) {
    res.sendStatus(404);
    return;
  }
  const { purpose_id, category_id, notes } = req.body as Partial<Call>;
  if (!purpose_id || !category_id || !notes) {
    res
      .status(400)
      .json({ error: 'purpose_id, category_id and notes are required' });
    return;
  }

  call.purpose_id = purpose_id;
  call.category_id = category_id;
  call.notes = notes;
  res.json(call);
});

app.get('/calls/:id', (req, res) => {
  const call = calls.find((c) => c.id === Number(req.params.id));
  if (!call) {
    res.sendStatus(404);
    return;
  }
  res.json(call);
});

app.get('/calls/:id/recording', (req, res) => {
  const call = calls.find((c) => c.id === Number(req.params.id));
  if (!call || !call.recording_url) {
    res.sendStatus(404);
    return;
  }
  const download = req.query.download === 'true';
  const user = req.user;
  if (
    download &&
    (!user || (user.role !== 'supervisor' && user.role !== 'admin'))
  ) {
    res.sendStatus(403);
    return;
  }
  res.json({ url: call.recording_url });
});

app.get('/users', (_req, res) => {
  res.json(users);
});

app.get('/dictionaries/purposes', (_req, res) => res.json(purposes));
app.get('/dictionaries/categories', (_req, res) => res.json(categories));
app.get('/dictionaries/subcategories', (_req, res) => res.json(subcategories));
app.get('/dictionaries/tags', (_req, res) => res.json(tags));

app.get('/export/calls.csv', (_req, res) => {
  res.type('text/csv');
  const lines = ['id,src_number,dst_number,status'];
  for (const c of calls) {
    lines.push(
      `${c.id},${c.src_number},${c.dst_number},${c.status}`
    );
  }
  res.send(lines.join('\n'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on ${port}`);
});

export default app;
