# copy-zendesk-attachments-to-google-drive-by-gas

## セットアップ

### GAS

#### コードの作成

- https://script.google.com を開く
- 「新しいプロジェクト」をクリック → copy-zendesk-attachments-to-google-drive-by-gas」などに変更
- 「エディタ」 > `Code.gs` にコードをコピペ。

#### プロジェクトの設定

サイドバーの「プロジェクトの設定」 > 「スクリプト プロパティ」 に以下の値を適切に設定

```js
const ZENDESK_SUBDOMAIN = getProp_('ZENDESK_SUBDOMAIN');          // Zendesk のインスタンスのサブドメイン
const ZENDESK_EMAIL = getProp_('ZENDESK_EMAIL');                  // Zendesk API を操作するユーザ権限のメールアドレス
const ZENDESK_API_TOKEN = getProp_('ZENDESK_API_TOKEN');          // 後で発行する Zendesk API トークン（後で設定）
const DRIVE_FOLDER_ID = getProp_('DRIVE_FOLDER_ID');              // Drive の該当フォルダを開いたときのURL https://drive.google.com/drive/folders/XXXXXXXX の XXXXXXXX の部分
const WEBHOOK_SHARED_SECRET = getProp_('WEBHOOK_SHARED_SECRET');  // ランダムな文字列など
```

#### 権限付与（最初の一回の実行時のみ作業）

- エディタ上部の関数ドロップダウンから `test_copy` を選択
- 「▶ 実行」 → Googleの認可ダイアログが出るので許可
- 使用するスコープは UrlFetchApp（外部通信）と DriveApp（ドライブ書き込み）など。

一度実行されるので、サイドバーの「実行数」から実行履歴を確認。

#### デプロイ

- エディタ右上「デプロイ」→「新しいデプロイ」
  - 種類: ウェブアプリ
  - 説明: （任意）
  - 次のユーザーとして実行:「自分」
  - アクセスできるユーザー: 用途に合わせて。
    - Zendesk から匿名で叩くなら「全員」
- デプロイ

表示された ウェブアプリURL を控える（ZendeskのWebhook先で使う）

以降はコードを変更した際は「バージョン更新」でデプロイを行う。そうするとウェブアプリURLが変わらない。

### Zendesk

#### Webhook の送信

- 管理センター > 「アプリおよびインテグレーション」 > 「Webhook」 で「Webhookを作成する」
  - 接続方法: Zendeskのイベント
    - イベントタイプ: 「コメントへの添付ファイルのリンク付け」
  - 詳細
    - 名前: （任意）
    - 説明: （任意）
    - エンドポイントURL: 前に控えた GAS ウェブアプリURL
    - リクエスト方法: POST
    - リクエスト形式: JSON
    - 認証: API キー
      - ヘッダー名: `x-shared-secret`
      - 値: 前に控えた`WEBHOOK_SHARED_SECRET` の値

上記で保存する。トリガーの設定は不要。

#### API Token の発行

- 管理センター > 「アプリおよびインテグレーション」 > 「APIトークン」 で「APIトークンを追加」
  - 説明: （任意）

表示されるトークンを控える。トークンは一度しか表示できず、分からなくなったら新たにまたAPIトークンを追加するしかない。

## 参考

### Zendesk Documents

[Ticket events | Zendesk Developer Docs](https://developer.zendesk.com/api-reference/webhooks/event-types/ticket-events/#attachment-linked-to-comment)

ペイロードのサンプル構造

```json
{
  "account_id": 8405679,
  "detail": {
    "actor_id": "8658726154110",
    "assignee_id": null,
    "brand_id": "13467642",
    "created_at": "2025-01-14T19:31:42Z",
    "custom_status": null,
    "description": "Hi There",
    "external_id": null,
    "form_id": "9006002",
    "group_id": "25522672",
    "id": "19395",
    "is_public": true,
    "organization_id": null,
    "priority": null,
    "requester_id": "8658726154110",
    "status": "NEW",
    "subject": "inline_appended_53cdde7bf2fbb479fa28176c1cd3e37c_1736883096",
    "submitter_id": "8658726154110",
    "tags": null,
    "type": null,
    "updated_at": "2025-01-14T19:31:42Z",
    "via": {
      "channel": "mail"
    }
  },
  "event": {
    "comment": {
      "attachment": {
        "content_type": "image/jpeg",
        "content_url": "https://z3nreplytoprocess-4-999.zendesk-staging.com/attachments/token/kPgFVVxSa6uIvrYg801uJkm7S/?name=MAGICC_logo_small.jpeg",
        "filename": "MAGICC_logo_small.jpeg",
        "id": "8658726230270",
        "is_public": false
      },
      "id": "8658726228478"
    }
  },
  "id": "030a3f7a-9bb9-47a4-9a36-6aa8f1d66783",
  "subject": "zen:ticket:19395",
  "time": "2025-01-14T19:31:42.692223355Z",
  "type": "zen:event-type:ticket.attachment_linked_to_comment",
  "zendesk_event_version": "2022-11-06"
}
```

## 発展

- Google Cloud Secret Manager でシークレットを管理する。 Script Property はシークレット管理ではない。
- GAS CLI https://github.com/google/clasp を導入。
