import http from 'node:http';
import worker from '../dist/server/index.js';
const server=http.createServer(async(req,res)=>{
  const body=[];for await(const chunk of req)body.push(chunk);
  const request=new Request('http://127.0.0.1:4173'+req.url,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(body)});
  const response=await worker.fetch(request,{});
  res.writeHead(response.status,Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
});
server.listen(4173,'127.0.0.1',()=>console.log('Local preview: http://127.0.0.1:4173'));
