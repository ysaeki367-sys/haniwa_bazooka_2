/**
 * haniwa bazooka 2 - Google Apps Script (Code.gs)
 *
 * これをGASプロジェクトに貼り付け、スプレッドシートに紐づけてWebアプリとして
 * デプロイすると、ゲームの LEADERBOARD がオンライン取得できるようになります。
 *
 * 【デプロイ手順】
 *  1. スプレッドシートを新規作成し、拡張機能 > Apps Script を開く
 *  2. このコードを Code.gs に貼り付けて保存
 *  3. 「デプロイ」>「新しいデプロイ」>種類「ウェブアプリ」
 *       - 次のユーザーとして実行: 自分
 *       - アクセスできるユーザー: 全員（Anyone）  ← ここが重要
 *  4. 発行された /exec URL を game.js の GAS_URL に貼り付ける
 *
 * シート「scores」の列: [timestamp, uuid, name, score, stage]
 */

var SHEET_NAME = "scores";

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(["timestamp", "uuid", "name", "score", "stage"]);
  }
  return sh;
}

function jsonOutput_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// スコア送信（ゲームからの POST）
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sh = getSheet_();
    var uuid = String(data.uuid || "");
    var name = String(data.name || "Player").slice(0, 10);
    var score = Number(data.score) || 0;
    var stage = Number(data.stage) || 1;

    // 同一UUIDのベストスコアのみ保持（任意。全記録を残したい場合はこのブロックを削除）
    var values = sh.getDataRange().getValues();
    var rowIndex = -1;
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][1]) === uuid) { rowIndex = i + 1; break; }
    }
    if (rowIndex > 0) {
      var prevScore = Number(values[rowIndex - 1][3]) || 0;
      if (score > prevScore) {
        sh.getRange(rowIndex, 1, 1, 5).setValues([[new Date(), uuid, name, score, stage]]);
      } else {
        sh.getRange(rowIndex, 3).setValue(name); // 名前だけ更新
      }
    } else {
      sh.appendRow([new Date(), uuid, name, score, stage]);
    }
    return jsonOutput_({ ok: true });
  } catch (err) {
    return jsonOutput_({ ok: false, error: String(err) });
  }
}

// ランキング取得（ゲームからの GET: ?action=ranking）
function doGet(e) {
  try {
    var sh = getSheet_();
    var values = sh.getDataRange().getValues();
    var rows = [];
    for (var i = 1; i < values.length; i++) {
      rows.push({
        uuid: String(values[i][1] || ""),
        name: values[i][2],
        score: Number(values[i][3]) || 0,
        stage: Number(values[i][4]) || 1
      });
    }
    rows.sort(function (a, b) {
      return b.score - a.score || b.stage - a.stage;
    });
    return jsonOutput_({ ranking: rows.slice(0, 10) });
  } catch (err) {
    return jsonOutput_({ ranking: [], error: String(err) });
  }
}
