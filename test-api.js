const fetch = require('node-fetch');

async function run() {
  try {
    const res = await fetch('http://localhost:5000/api/events/admin/overview', {
        // we can just test if it returns 200 without token since we just removed protect temporarily or something... wait no, it's protected
    });
    console.log(res.status);
    console.log(await res.text());
  } catch(e) {
    console.log(e);
  }
}
run();
