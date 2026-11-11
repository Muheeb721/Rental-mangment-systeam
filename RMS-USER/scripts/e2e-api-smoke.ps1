$api='http://localhost:5000/api'
try {
  Write-Host '[PS] Logging in as admin...'
  $login = Invoke-RestMethod -Uri "$api/auth/login" -Method Post -Body (@{email='admin@rms.com';password='admin123'} | ConvertTo-Json) -ContentType 'application/json' -ErrorAction Stop
  if ($login.data.token) { $token = $login.data.token } else { $token = $login.token }
  if (-not $token) { Write-Error 'No token received'; exit 2 }
  Write-Host '[PS] Token length:' ($token.Length)

  $headers = @{ Authorization = "Bearer $token"; 'Content-Type' = 'application/json' }

  Write-Host '[PS] Creating test user...'
  $rnd = Get-Random -Minimum 1000 -Maximum 9999
  $userPayload = @{ name='Smoke Test User'; email = "smoke+$rnd@example.com"; password='Test@1234'; phone='+923001112233'; role='tenant' }
  $user = Invoke-RestMethod -Uri "$api/admin/users" -Method Post -Body ($userPayload | ConvertTo-Json) -Headers $headers -ContentType 'application/json' -ErrorAction Stop
  if ($user.data._id) { $userId = $user.data._id } else { $userId = $user.data.id }
  Write-Host '[PS] Created user id:' $userId

  Write-Host '[PS] Creating test property...'
  $propRnd = Get-Random -Minimum 1000 -Maximum 9999
  $propertyPayload = @{ title = "Smoke Property $propRnd"; propertyType='House'; category='House'; description='Smoke test property'; price=1000000; rent=50000; location='DHA Phase 5'; city='Karachi'; address='Test address'; bedrooms=3; bathrooms=2; area=1200; ownerName='Owner'; ownerPhone='+923001112233'; ownerEmail='owner@example.com'; status='Available' }
  $prop = Invoke-RestMethod -Uri "$api/admin/properties" -Method Post -Body ($propertyPayload | ConvertTo-Json) -Headers $headers -ContentType 'application/json' -ErrorAction Stop
  if ($prop.data._id) { $propId = $prop.data._id } else { $propId = $prop.data.id }
  Write-Host '[PS] Created property id:' $propId

  Write-Host '[PS] Creating booking...'
  $bookingPayload = @{ userId = $userId; userName = $user.data.name; userEmail = $user.data.email; propertyId = $propId; propertyTitle = $prop.data.title; propertyType = $prop.data.propertyType; amount = 50000; bookingStatus='Pending'; paymentStatus='Pending' }
  $bk = Invoke-RestMethod -Uri "$api/bookings" -Method Post -Body ($bookingPayload | ConvertTo-Json) -ContentType 'application/json' -ErrorAction Stop
  if ($bk.data._id) { $bookingId = $bk.data._id } else { $bookingId = $bk.data.bookingId }
  Write-Host '[PS] Created booking id:' $bookingId
  Write-Host '[PS] Approving booking' $bookingId
  $approve = Invoke-RestMethod -Uri "$api/bookings/$bookingId/approve" -Method Post -Headers $headers -ContentType 'application/json' -ErrorAction Stop
  Write-Host '[PS] Booking approved.'

  Write-Host '[PS] Creating payment...'
  $paymentPayload = @{ userId = $userId; userName = $user.data.name; userEmail = $user.data.email; bookingId = $bookingId; propertyId = $propId; propertyName = $prop.data.title; amount = 50000; totalAmount = 50000; amountPaid = 50000; remainingAmount = 0; paymentType='Rent'; method='Bank Transfer'; status='Pending' }
  $pay = Invoke-RestMethod -Uri "$api/payments" -Method Post -Body ($paymentPayload | ConvertTo-Json) -Headers $headers -ContentType 'application/json' -ErrorAction Stop
  if ($pay.data._id) { $payId = $pay.data._id } else { $payId = $pay.data.id }
  Write-Host '[PS] Created payment id:' $payId

  $paymentId = $payId
  Write-Host '[PS] Approving payment' $paymentId
  $appr = Invoke-RestMethod -Uri "$api/admin/payment/approve" -Method Post -Body (@{ userId = $userId; userName = $user.data.name; paymentId = $paymentId; propertyName = $prop.data.title } | ConvertTo-Json) -Headers $headers -ContentType 'application/json' -ErrorAction Stop
  Write-Host '[PS] Payment approved.'

  Write-Host "`nSMOKE TEST: SUCCESS"
  exit 0
} catch {
  Write-Error "SMOKE TEST: FAIL - $($_.Exception.Message)"
  exit 2
}