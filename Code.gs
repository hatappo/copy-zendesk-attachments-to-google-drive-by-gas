const ZENDESK_SUBDOMAIN = getProp_('ZENDESK_SUBDOMAIN');          // Zendesk のインスタンスのサブドメイン
const ZENDESK_EMAIL = getProp_('ZENDESK_EMAIL');                  // Zendesk API を操作するユーザ権限のメールアドレス
const ZENDESK_API_TOKEN = getProp_('ZENDESK_API_TOKEN');          // 後で発行する Zendesk API トークン（後で設定）
const DRIVE_FOLDER_ID = getProp_('DRIVE_FOLDER_ID');              // Drive の該当フォルダを開いたときのURL https://drive.google.com/drive/folders/XXXXXXXX の XXXXXXXX の部分
const WEBHOOK_SHARED_SECRET = getProp_('WEBHOOK_SHARED_SECRET');  // ランダムな文字列など

function test_copy() {
  copyAttachmentsFromTicket(26027); // ← 任意のチケットIDに書き換えて実行
}

// 単発実行：チケットIDを指定して添付を全部コピー
function copyAttachmentsFromTicket(ticketId) {
  if (!ticketId) throw new Error('ticketId is required');

  const auth = Utilities.base64Encode(`${ZENDESK_EMAIL}/token:${ZENDESK_API_TOKEN}`);
  const headers = { 'Authorization': `Basic ${auth}` };

  let url = `https://${ZENDESK_SUBDOMAIN}.zendesk.com/api/v2/tickets/${ticketId}/comments.json`;
  let saved = 0;

  while (url) {
    const res = UrlFetchApp.fetch(url, { method: 'get', headers, muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) {
      throw new Error(`Zendesk API error: ${res.getResponseCode()} ${res.getContentText()}`);
    }
    const json = JSON.parse(res.getContentText());
    const comments = json.comments || [];

    for (const c of comments) {
      const attachments = c.attachments || [];
      if (attachments.length > 0) {
        saved += saveAttachmentsToDrive_(attachments);
      }
    }
    url = json.next_page || null; // ページネーション
  }

  Logger.log(`Saved ${saved} files from ticket ${ticketId}`);
  return saved;
}

/** Webhook受信：添付ファイル(群)をダイレクト保存 **/
function doPost(e) {
  try {
    // 簡易認証：Zendeskから付与させたヘッダを検証
    // const tokenFromHeader = (e?.headers?.['x-shared-secret']) || '';
    // if (WEBHOOK_SHARED_SECRET && tokenFromHeader !== WEBHOOK_SHARED_SECRET) {
    //   Logger.log("WEBHOOK_SHARED_SECRET が一致しませんでした。")
    //   return ContentService.createTextOutput('Unauthorized').setMimeType(ContentService.MimeType.TEXT);
    // }

    const raw = e?.postData?.contents || '';
    const body = raw ? JSON.parse(raw) : {};

    // body.event.comment.attachment もしくは body.event.comment.attachments[]
    const attField = body?.event?.comment?.attachment || body?.event?.comment?.attachments;
    const attachments = Array.isArray(attField) ? attField : (attField ? [attField] : []);

    if (!attachments.length) {
      Logger.log('No attachments in payload: ' + JSON.stringify(body));
      return ContentService.createTextOutput('No attachments').setMimeType(ContentService.MimeType.TEXT);
    }

    const saved = saveAttachmentsToDrive_(attachments);
    Logger.log(`Saved ${saved} files`);
    return ContentService.createTextOutput(`OK: saved ${saved} file(s)`).setMimeType(ContentService.MimeType.TEXT);
  } catch (err) {
    console.error(err);
    return ContentService.createTextOutput('NG').setMimeType(ContentService.MimeType.TEXT);
  }
}

/** 添付ファイルをDriveへ保存 **/
function saveAttachmentsToDrive_(attachments) {
  const auth = Utilities.base64Encode(`${ZENDESK_EMAIL}/token:${ZENDESK_API_TOKEN}`);
  const headers = { 'Authorization': `Basic ${auth}` };

  const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  let saved = 0;

  for (const a of attachments) {
    // a の想定 { id, filename, content_url, content_type, is_public, ... }
    if (!a?.content_url) continue;

    // content_url はZenddeskの設定次第では 短命トークン and/or 認証必須 の場合もあるので注意。
    const res = UrlFetchApp.fetch(a.content_url, { method: 'get', headers, muteHttpExceptions: true });
    const code = res.getResponseCode();
    if (code !== 200) {
      Logger.log(`Download failed id=${a.id} code=${code} body=${res.getContentText()}`);
      continue; // 必要に応じてリトライ/エラー通知
    }

    const filename = `${a.id}_${a.filename || 'attachment'}`;
    const blob = res.getBlob().setName(filename);
    folder.createFile(blob);
    saved++;
  }
  return saved;
}

/*** スクリプトプロパティのヘルパ ***/
function setProp_(key, value) { PropertiesService.getScriptProperties().setProperty(key, value); }
function getProp_(key) { return PropertiesService.getScriptProperties().getProperty(key); }
