import {NextRequest, NextResponse} from 'next/server';
import webpush from 'web-push';

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

type PushRequestBody = {
  subscription: {
    endpoint: string;
    keys: {p256dh: string; auth: string};
  };
  title: string;
  body: string;
  url: string;
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = req.headers.get('x-push-secret');
  if (!secret || secret !== process.env.PUSH_INTERNAL_SECRET) {
    return NextResponse.json({error: 'Forbidden'}, {status: 403});
  }

  let payload: PushRequestBody;
  try {
    payload = (await req.json()) as PushRequestBody;
  } catch {
    return NextResponse.json({error: 'Invalid JSON'}, {status: 400});
  }

  try {
    await webpush.sendNotification(
      payload.subscription,
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        url: payload.url,
      }),
    );
    return NextResponse.json({ok: true});
  } catch (err: unknown) {
    const status =
      err !== null &&
      typeof err === 'object' &&
      'statusCode' in err &&
      typeof (err as {statusCode: unknown}).statusCode === 'number'
        ? (err as {statusCode: number}).statusCode
        : 500;

    // 410 = subscription expired; caller removes it from DB
    return NextResponse.json({error: 'Push failed'}, {status});
  }
}
