import webpush from 'web-push';

const keys = webpush.generateVAPIDKeys();

console.log('Agrega estas variables a tu .env.local y a Vercel:\n');
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
