import type { Pool } from 'pg';

export interface SendMailParams {
  receiverCharId: number;
  senderName?: string;
  title: string;
  content: string;
  itemId?: number;
  itemCount?: number;
  isBound?: boolean;
  gold?: number;
}

export interface SendAccountMailParams {
  accountId: number;
  senderName?: string;
  title: string;
  content: string;
  itemId?: number;
  itemCount?: number;
  isBound?: boolean;
  gold?: number;
}

/**
 * Sends a personal in-game mail to a character (player_mail + mailitem).
 * Displays in the "Surat Pribadi" / Personal Mail tab in the in-game mailbox.
 */
export async function sendCharacterMail(
  gameDb: Pool,
  params: SendMailParams
): Promise<{ mailId: number; itemUid?: number }> {
  const {
    receiverCharId,
    senderName = 'Sistem VIP',
    title,
    content,
    itemId = 0,
    itemCount = 1,
    isBound = true,
    gold = 0,
  } = params;

  const nowUnix = Math.floor(Date.now() / 1000);
  const dueDate = nowUnix + 30 * 86400; // 30 days expiry

  // 1. Get next mail ID from player_mail
  const mailIdRes = await gameDb.query<{ next_id: string }>(
    `SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM public.player_mail`
  );
  const nextMailId = parseInt(mailIdRes.rows[0]?.next_id || '1', 10);

  // 2. Insert into player_mail
  await gameDb.query(
    `INSERT INTO public.player_mail (
       id, receiver_id, sender_id, sender_name, send_time, due_date,
       title, content, item_id, gold, crystal, cod, opened, returned,
       authoritative, cod_gold
     ) VALUES (
       $1, $2, 0, $3, $4, $5,
       $6, $7, $8, $9, 0, 0, 0, 0,
       1, 0
     )`,
    [
      nextMailId,
      receiverCharId,
      senderName.slice(0, 32),
      nowUnix,
      dueDate,
      title.slice(0, 40),
      content,
      itemId > 0 ? itemId : 0,
      Math.max(0, gold),
    ]
  );

  let nextItemUid: number | undefined;

  // 3. If an item is attached, insert into mailitem
  if (itemId > 0) {
    const uidRes = await gameDb.query<{ next_uid: string }>(
      `SELECT COALESCE(MAX(id), 50000000) + 1 AS next_uid FROM (
         SELECT id FROM public.inventory1
         UNION ALL
         SELECT id FROM public.account_mailitem
         UNION ALL
         SELECT id FROM public.mailitem
       ) t`
    );
    nextItemUid = parseInt(uidRes.rows[0]?.next_uid || '50000001', 10);

    await gameDb.query(
      `INSERT INTO public.mailitem (
         id, item_id, durability, maker, identify, embedded_amount, embedded_id1,
         create_time, due_date, container_index, combo_id, strengthen, cur_maxdurability,
         bind, player_id, mail_id
       ) VALUES (
         $1, $2, $3, '', 1, 0, -1,
         $4, 0, -1, 0, 0, 100,
         $5, $6, $7
       )`,
      [
        nextItemUid,
        itemId,
        Math.max(1, itemCount),
        nowUnix,
        isBound ? 1 : 0,
        receiverCharId,
        nextMailId,
      ]
    );
  }

  // 4. Increment new_mail indicator on character
  await gameDb.query(
    `UPDATE public.player_characters
     SET new_mail = COALESCE(new_mail, 0) + 1
     WHERE id = $1`,
    [receiverCharId]
  );

  return { mailId: nextMailId, itemUid: nextItemUid };
}

/**
 * Sends an account-wide in-game mail (player_account_mail + account_mailitem).
 * Displays in the "Surat Akun" / Account Mail tab in the in-game mailbox.
 */
export async function sendAccountMail(
  gameDb: Pool,
  params: SendAccountMailParams
): Promise<{ mailId: number; itemUid?: number }> {
  const {
    accountId,
    senderName = 'Sistem VIP',
    title,
    content,
    itemId = 0,
    itemCount = 1,
    isBound = true,
    gold = 0,
  } = params;

  const nowUnix = Math.floor(Date.now() / 1000);
  const dueDate = nowUnix + 30 * 86400;

  const mailIdRes = await gameDb.query<{ next_id: string }>(
    `SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM public.player_account_mail`
  );
  const nextMailId = parseInt(mailIdRes.rows[0]?.next_id || '1', 10);

  await gameDb.query(
    `INSERT INTO public.player_account_mail (
       id, receiver_id, sender_id, sender_name, send_time, due_date,
       title, content, item_id, gold, opened, authoritative
     ) VALUES (
       $1, $2, 0, $3, $4, $5,
       $6, $7, $8, $9, 0, 0
     )`,
    [
      nextMailId,
      accountId,
      senderName.slice(0, 32),
      nowUnix,
      dueDate,
      title.slice(0, 40),
      content,
      itemId > 0 ? itemId : 0,
      Math.max(0, gold),
    ]
  );

  let nextItemUid: number | undefined;

  if (itemId > 0) {
    const uidRes = await gameDb.query<{ next_uid: string }>(
      `SELECT COALESCE(MAX(id), 50000000) + 1 AS next_uid FROM (
         SELECT id FROM public.inventory1
         UNION ALL
         SELECT id FROM public.account_mailitem
         UNION ALL
         SELECT id FROM public.mailitem
       ) t`
    );
    nextItemUid = parseInt(uidRes.rows[0]?.next_uid || '50000001', 10);

    await gameDb.query(
      `INSERT INTO public.account_mailitem (
         id, item_id, durability, maker, identify, embedded_amount, embedded_id1,
         create_time, due_date, container_index, combo_id, strengthen, cur_maxdurability,
         bind, account_id, mail_id
       ) VALUES (
         $1, $2, $3, '', 1, 0, -1,
         $4, 0, -1, 0, 0, 100,
         $5, $6, $7
       )`,
      [
        nextItemUid,
        itemId,
        Math.max(1, itemCount),
        nowUnix,
        isBound ? 1 : 0,
        accountId,
        nextMailId,
      ]
    );
  }

  await gameDb.query(
    `UPDATE public.player_characters
     SET new_mail = COALESCE(new_mail, 0) + 1
     WHERE account_id = $1`,
    [accountId]
  );

  return { mailId: nextMailId, itemUid: nextItemUid };
}
