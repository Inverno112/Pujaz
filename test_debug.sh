cd ms-transaccional
sed -i 's/t.Errorf("Expected status 201, got %d", resp.StatusCode)/var body []byte; resp.Body.Read(body); t.Errorf("Expected status 201, got %d, body: %s", resp.StatusCode, string(body))/' src/controllers/auction_test.go
