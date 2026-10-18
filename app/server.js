'use strict';
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const prom = require('prom-client');
const path = require('path');
const v = require('./validation');

for (const name of ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_SECRET']) {
  if (!process.env[name]) throw new Error(`Missing environment variable: ${name}`);
}
if (process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters');
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false })); // CSP is set explicitly by Nginx.
app.use(express.json({ limit: '20kb' }));
app.use(cookieParser());
const pool = new Pool({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME, max: 10,
  connectionTimeoutMillis: 8000, idleTimeoutMillis: 30000
});
const cookieName = 'tt_session';
const isHttps = process.env.COOKIE_SECURE === 'true';
const cookieOpts = { httpOnly: true, secure: isHttps, sameSite: 'strict', path: '/', maxAge: 7 * 24 * 3600 * 1000 };
const failed = (res, status, message) => res.status(status).json({ error: message });
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const log = (level, event, fields={}) => console.log(JSON.stringify({ timestamp:new Date().toISOString(), service:'tasktracker', level, event, ...fields }));

prom.collectDefaultMetrics({ prefix: 'tasktracker_' });
const requests = new prom.Counter({ name:'tasktracker_http_requests_total', help:'HTTP requests', labelNames:['method','route','status'] });
const latency = new prom.Histogram({ name:'tasktracker_http_duration_seconds', help:'HTTP duration seconds', labelNames:['method','route'], buckets:[.01,.025,.05,.1,.25,.5,1,2,5] });
app.use((req,res,next) => {
  const end = latency.startTimer();
  res.on('finish', () => {
    const route = req.route?.path || (req.path.startsWith('/api/') ? '/api/other' : '/other');
    requests.inc({method:req.method,route,status:String(res.statusCode)});
    end({method:req.method,route});
    if(req.path.startsWith('/api/') && req.path !== '/api/health') log(res.statusCode >= 500?'error':'info', 'http_request', {method:req.method,path:req.path,status:res.statusCode});
  });
  next();
});
app.get('/healthz', asyncRoute(async (_req,res) => { await pool.query('SELECT 1'); res.json({ status:'ok', db:'connected' }); }));
app.get('/metrics', asyncRoute(async (_req,res)=> { res.set('Content-Type', prom.register.contentType); res.end(await prom.register.metrics()); }));

// Cookie authentication with same-origin verification for unsafe requests.
app.use('/api', (req,res,next) => {
  if (!['GET','HEAD','OPTIONS'].includes(req.method)) {
    const origin=req.get('Origin');
    const host=req.get('Host');
    if(origin) {
      try { if(new URL(origin).host !== host) return failed(res,403,'Nguồn yêu cầu không hợp lệ'); }
      catch { return failed(res,403,'Nguồn yêu cầu không hợp lệ'); }
    }
    // Modern browsers attach Origin. Missing Origin allowed for CLI/curl demos.
  }
  next();
});
app.use('/api/auth', rateLimit({ windowMs:15*60*1000, limit:30, standardHeaders:'draft-7', legacyHeaders:false }));
function sign(res, user) {
  const token=jwt.sign({sub:user.id},process.env.JWT_SECRET,{algorithm:'HS256',expiresIn:'7d',issuer:'tasktracker'});
  res.cookie(cookieName,token,cookieOpts);
}
const auth = asyncRoute(async (req,res,next)=> {
  const token=req.cookies[cookieName];
  if(!token) return failed(res,401,'Bạn chưa đăng nhập');
  let payload;
  try { payload=jwt.verify(token,process.env.JWT_SECRET,{algorithms:['HS256'],issuer:'tasktracker'}); }
  catch { return failed(res,401,'Phiên đăng nhập đã hết hạn'); }
  const result=await pool.query('SELECT id, name, email FROM users WHERE id=$1',[payload.sub]);
  if(!result.rowCount) return failed(res,401,'Tài khoản không tồn tại');
  req.user=result.rows[0]; next();
});
app.post('/api/auth/register',asyncRoute(async(req,res)=>{
  const name=v.text(req.body.name,80), mail=v.email(req.body.email), pass=req.body.password;
  if(name.length<2 || !mail || !v.password(pass)) return failed(res,400,'Tên tối thiểu 2 ký tự; email hợp lệ; mật khẩu từ 10 ký tự, có chữ và số');
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const hash=await bcrypt.hash(pass,12);
    const u=await client.query('INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id,name,email',[name,mail,hash]);
    const project=await client.query('INSERT INTO projects(name,description,owner_id) VALUES($1,$2,$3) RETURNING id',['Không gian cá nhân','Danh sách công việc riêng của bạn',u.rows[0].id]);
    await client.query('INSERT INTO project_members(project_id,user_id,role) VALUES($1,$2,$3)',[project.rows[0].id,u.rows[0].id,'owner']);
    await client.query('COMMIT');
    sign(res,u.rows[0]); log('info','user_registered',{user_id:u.rows[0].id});
    res.status(201).json({user:u.rows[0]});
  } catch(e) {
    await client.query('ROLLBACK');
    if(e.code==='23505') return failed(res,409,'Email đã được sử dụng');
    throw e;
  } finally { client.release(); }
}));
app.post('/api/auth/login',asyncRoute(async(req,res)=>{
  const mail=v.email(req.body.email), pass=req.body.password;
  if(!mail || typeof pass!=='string') return failed(res,400,'Email hoặc mật khẩu không hợp lệ');
  const r=await pool.query('SELECT id,name,email,password_hash FROM users WHERE email=$1',[mail]);
  if(!r.rowCount || !(await bcrypt.compare(pass,r.rows[0].password_hash))) return failed(res,401,'Email hoặc mật khẩu không đúng');
  const {password_hash:_,...user}=r.rows[0]; sign(res,user); log('info','user_login',{user_id:user.id}); res.json({user});
}));
app.post('/api/auth/logout',(_req,res)=>{ res.clearCookie(cookieName,{ path:'/',sameSite:'strict',secure:isHttps,httpOnly:true }); res.json({ok:true}); });
app.get('/api/auth/me',auth,(req,res)=>res.json({user:req.user}));

async function membership(userId,projectId){
  const r=await pool.query('SELECT role FROM project_members WHERE user_id=$1 AND project_id=$2',[userId,projectId]);
  return r.rows[0]?.role || null;
}
app.get('/api/projects',auth,asyncRoute(async(req,res)=>{
  const r=await pool.query(`SELECT p.id,p.name,p.description,p.created_at,pm.role,
   (SELECT count(*)::int FROM project_members x WHERE x.project_id=p.id) member_count
   FROM projects p JOIN project_members pm ON pm.project_id=p.id
   WHERE pm.user_id=$1 ORDER BY p.created_at ASC`,[req.user.id]);
  res.json({projects:r.rows});
}));
app.post('/api/projects',auth,asyncRoute(async(req,res)=>{
  const name=v.text(req.body.name,90), description=v.text(req.body.description,400);
  if(name.length<2) return failed(res,400,'Tên nhóm tối thiểu 2 ký tự');
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const p=await client.query('INSERT INTO projects(name,description,owner_id) VALUES($1,$2,$3) RETURNING *',[name,description,req.user.id]);
    await client.query('INSERT INTO project_members(project_id,user_id,role) VALUES($1,$2,$3)',[p.rows[0].id,req.user.id,'owner']);
    await client.query('COMMIT');
    res.status(201).json({project:p.rows[0]});
  } catch(e) {await client.query('ROLLBACK');throw e;} finally {client.release();}
}));
app.get('/api/projects/:id/members',auth,asyncRoute(async(req,res)=>{
  if(!v.uuid(req.params.id)) return failed(res,400,'Mã nhóm không hợp lệ');
  if(!await membership(req.user.id,req.params.id)) return failed(res,403,'Không có quyền xem nhóm');
  const r=await pool.query('SELECT u.id,u.name,u.email,pm.role FROM project_members pm JOIN users u ON u.id=pm.user_id WHERE pm.project_id=$1 ORDER BY pm.joined_at',[req.params.id]);
  res.json({members:r.rows});
}));
app.post('/api/projects/:id/members',auth,asyncRoute(async(req,res)=>{
  if(!v.uuid(req.params.id)) return failed(res,400,'Mã nhóm không hợp lệ');
  if(await membership(req.user.id,req.params.id)!=='owner') return failed(res,403,'Chỉ chủ nhóm được thêm thành viên');
  const mail=v.email(req.body.email);
  if(!mail) return failed(res,400,'Email không hợp lệ');
  const u=await pool.query('SELECT id FROM users WHERE email=$1',[mail]);
  if(!u.rowCount) return failed(res,404,'Người dùng phải đăng ký tài khoản trước');
  await pool.query(`INSERT INTO project_members(project_id,user_id,role) VALUES($1,$2,'member') ON CONFLICT(project_id,user_id) DO NOTHING`,[req.params.id,u.rows[0].id]);
  res.status(201).json({ok:true});
}));
app.get('/api/tasks',auth,asyncRoute(async(req,res)=>{
  const project=req.query.project_id || null;
  if(project && !v.uuid(project)) return failed(res,400,'Mã nhóm không hợp lệ');
  const r=await pool.query(`SELECT t.id,t.project_id,t.title,t.description,t.status,t.priority,t.due_date,t.created_at,t.updated_at,
   t.created_by,t.assigned_to,p.name project_name,u.name assignee_name
   FROM tasks t JOIN project_members pm ON pm.project_id=t.project_id AND pm.user_id=$1
   JOIN projects p ON p.id=t.project_id LEFT JOIN users u ON u.id=t.assigned_to
   WHERE ($2::uuid IS NULL OR t.project_id=$2::uuid)
   ORDER BY CASE WHEN t.status='done' THEN 1 ELSE 0 END, t.due_date ASC NULLS LAST,t.created_at DESC LIMIT 500`,[req.user.id,project]);
  res.json({tasks:r.rows});
}));
function taskPayload(body) {
  const title=v.text(body.title,160),description=v.text(body.description,1200),status=body.status ?? 'todo',priority=body.priority ?? 'medium',due=body.due_date || null, assigned=body.assigned_to || null;
  if(title.length<2 || !v.oneOf(status,['todo','doing','done']) || !v.oneOf(priority,['low','medium','high']) || !v.dateOnly(due) || (assigned&&!v.uuid(assigned))) return null;
  return {title,description,status,priority,due,assigned};
}
async function assignable(assignee, projectId) {
  if(!assignee) return true;
  return Boolean(await membership(assignee,projectId));
}
app.post('/api/tasks',auth,asyncRoute(async(req,res)=>{
  const id=req.body.project_id, b=taskPayload(req.body);
  if(!v.uuid(id)||!b) return failed(res,400,'Dữ liệu công việc không hợp lệ');
  if(!await membership(req.user.id,id)) return failed(res,403,'Không thuộc nhóm');
  if(!await assignable(b.assigned,id)) return failed(res,400,'Người được giao không thuộc nhóm');
  const r=await pool.query(`INSERT INTO tasks(project_id,title,description,status,priority,due_date,assigned_to,created_by)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,[id,b.title,b.description,b.status,b.priority,b.due,b.assigned,req.user.id]);
  log('info','task_created',{task_id:r.rows[0].id,user_id:req.user.id});
  res.status(201).json({id:r.rows[0].id});
}));
app.patch('/api/tasks/:id',auth,asyncRoute(async(req,res)=>{
  if(!v.uuid(req.params.id)) return failed(res,400,'Mã công việc không hợp lệ');
  const found=await pool.query(`SELECT t.*,pm.role FROM tasks t JOIN project_members pm ON pm.project_id=t.project_id AND pm.user_id=$2 WHERE t.id=$1`,[req.params.id,req.user.id]);
  if(!found.rowCount) return failed(res,404,'Không tìm thấy công việc');
  const t=found.rows[0];
  if(t.created_by!==req.user.id && t.assigned_to!==req.user.id && t.role!=='owner') return failed(res,403,'Không có quyền sửa công việc');
  const b=taskPayload({...t,...req.body,due_date:req.body.due_date===undefined?t.due_date?.toISOString?.().slice(0,10)??null:req.body.due_date});
  if(!b || !await assignable(b.assigned,t.project_id)) return failed(res,400,'Dữ liệu không hợp lệ hoặc người được giao không thuộc nhóm');
  const r=await pool.query(`UPDATE tasks SET title=$1,description=$2,status=$3,priority=$4,due_date=$5,assigned_to=$6,updated_at=now() WHERE id=$7 RETURNING id`,
    [b.title,b.description,b.status,b.priority,b.due,b.assigned,req.params.id]);
  log('info','task_updated',{task_id:req.params.id,user_id:req.user.id});res.json({task:r.rows[0]});
}));
app.delete('/api/tasks/:id',auth,asyncRoute(async(req,res)=>{
  if(!v.uuid(req.params.id)) return failed(res,400,'Mã công việc không hợp lệ');
  const r=await pool.query(`DELETE FROM tasks t USING project_members pm WHERE t.id=$1 AND pm.project_id=t.project_id AND pm.user_id=$2 AND (pm.role='owner' OR t.created_by=$2) RETURNING t.id`,[req.params.id,req.user.id]);
  if(!r.rowCount) return failed(res,403,'Không có quyền xóa công việc');
  log('info','task_deleted',{task_id:req.params.id,user_id:req.user.id}); res.json({ok:true});
}));
app.get('/api/stats',auth,asyncRoute(async(req,res)=>{
  const r=await pool.query(`SELECT count(*)::int total,count(*) FILTER(WHERE status='todo')::int todo,
    count(*) FILTER(WHERE status='doing')::int doing,count(*) FILTER(WHERE status='done')::int done,
    count(*) FILTER(WHERE due_date<CURRENT_DATE AND status<>'done')::int overdue
    FROM tasks t WHERE EXISTS(SELECT 1 FROM project_members pm WHERE pm.project_id=t.project_id AND pm.user_id=$1)`,[req.user.id]);
  res.json({stats:r.rows[0]});
}));
app.use('/api',(_req,res)=>failed(res,404,'Không tìm thấy API'));
app.use(express.static(path.join(__dirname,'public'),{maxAge:'1h',etag:true}));
app.get('*',(_req,res)=>res.sendFile(path.join(__dirname,'public/index.html')));
app.use((err,req,res,_next)=> {
  log('error','unhandled_error',{method:req.method,path:req.path,message:err.message,code:err.code});
  if(res.headersSent) return;
  failed(res,500,'Đã xảy ra lỗi máy chủ. Hãy thử lại.');
});
const port=Number(process.env.PORT||3000);
const server=app.listen(port,'0.0.0.0',()=>log('info','server_started',{port}));
function shutdown(){server.close(()=>pool.end().then(()=>process.exit(0)));setTimeout(()=>process.exit(1),10000).unref();}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
