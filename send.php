<?php
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

$to = 'lindilove.info@gmail.com';
$formType = trim($_POST['form_type'] ?? 'contact');
$name = trim($_POST['name'] ?? '');
$email = trim($_POST['email'] ?? '');
$phone = trim($_POST['phone'] ?? '');
$message = trim($_POST['message'] ?? '');
$product = trim($_POST['product'] ?? '');

$name = preg_replace("/[\r\n]+/", ' ', $name);
$product = preg_replace("/[\r\n]+/", ' ', $product);
$email = filter_var($email, FILTER_SANITIZE_EMAIL);

if (!$name || !$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid input']);
    exit;
}

$subject = $formType === 'order'
    ? 'Нова поръчка от сайта'
    : 'Ново запитване от сайта';

$lines = [];
$lines[] = 'Тип' . ': ' . $formType;
$lines[] = 'Име' . ': ' . $name;
$lines[] = 'Имейл' . ': ' . $email;
if ($phone !== '') {
    $lines[] = 'Телефон' . ': ' . $phone;
}
if ($product !== '') {
    $lines[] = 'Продукт' . ': ' . $product;
}
$lines[] = 'Съобщение' . ':';
$lines[] = $message !== '' ? $message : '-';
$body = implode("\n", $lines);

$host = $_SERVER['HTTP_HOST'] ?? 'localhost';
$from = 'no-reply@' . $host;
$headers = [];
$headers[] = 'From: LindiLove <' . $from . '>';
$headers[] = 'Reply-To: ' . $email;
$headers[] = 'Content-Type: text/plain; charset=UTF-8';

$encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';

$sent = mail($to, $encodedSubject, $body, implode("\r\n", $headers));

if (!$sent) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Send failed']);
    exit;
}

echo json_encode(['ok' => true]);
?>
