<?php
http_response_code(410);header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');echo json_encode(['error'=>'مسیر قدیمی بسته شده است؛ از صفحه اصلی وارد شوید.'],JSON_UNESCAPED_UNICODE);
