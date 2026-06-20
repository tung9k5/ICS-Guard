# Quy Trình Làm Việc Với Git & GitHub (ICS-Guard Team)

## 1. Nguyên Tắc Chung (General Principles)

1. **Không commit trực tiếp lên nhánh chính (`main`/`master` hoặc `develop`):** Mọi sự phát triển, sửa lỗi phải được làm trên nhánh phụ (`feature/*`, `bugfix/*`, v.v.) và đưa vào nhánh chung qua **Pull Request (PR)**.
2. **Đồng bộ code thường xuyên:** Trước khi bắt đầu viết code mới hoặc trước khi tạo Pull Request, luôn kéo (pull) code mới nhất từ nhánh chính về.
3. **Commit nhỏ và rõ nghĩa:** Không gom quá nhiều tính năng/sửa đổi khác nhau vào trong một commit duy nhất. Mỗi commit nên giải quyết một vấn đề cụ thể.
4. **Kiểm thử trước khi Push:** Đảm bảo code của bạn chạy được cục bộ (không lỗi cú pháp, build thành công, test không lỗi) trước khi push lên GitHub.

---

## 2. Quy Định Đặt Tên Nhánh (Branch Naming)

Tên nhánh cần được đặt theo định dạng: **`loại-nhánh/tác-vụ-viết-thường-khó-dấu`**. Các loại nhánh chính bao gồm:

| Loại nhánh | Mục đích sử dụng | Ví dụ thực tế |
| :--- | :--- | :--- |
| `feature/` | Phát triển một tính năng hoặc module mới | `feature/mqtt-simulator`, `feature/dashboard-alerts` |
| `bugfix/` | Sửa chữa các lỗi phát hiện được | `bugfix/jwt-expiration-error`, `bugfix/mqtt-reconnect` |
| `docs/` | Viết tài liệu hướng dẫn, cập nhật README | `docs/add-github-workflow`, `docs/api-spec` |
| `refactor/` | Tối ưu hóa, dọn dẹp code (không đổi tính năng) | `refactor/auth-middleware`, `refactor/folder-structure` |
| `test/` | Viết thêm hoặc cập nhật các test case | `test/backend-unit-test`, `test/security-scenarios` |

---

## 3. Quy Trình Phát Triển 6 Bước (6-Step Development Workflow)

### Bước 1: Đồng bộ nhánh phát triển chung (`develop` hoặc `main`)
Trước khi làm task mới, hãy chuyển về nhánh chung và cập nhật code mới nhất từ remote repository:
```bash
git checkout main
git pull origin main
```

### Bước 2: Tạo nhánh mới từ nhánh chung
Tạo một nhánh mới để thực hiện task được giao (nhớ tuân thủ quy tắc đặt tên nhánh ở Mục 2):
```bash
git checkout -b feature/ten-tinh-nang-moi
```

### Bước 3: Phát triển mã nguồn và commit cục bộ (Local Commit)
Trong quá trình code, hãy commit thường xuyên sau khi hoàn thành từng phần nhỏ ổn định:
```bash
git add .
git commit -m "<loại-commit>(<phạm-vi-ảnh-hưởng>): <mô tả ngắn bằng tiếng Việt hoặc tiếng Anh>"
```
*(Tham khảo quy chuẩn viết Commit Message ở Mục 4)*

### Bước 4: Đồng bộ và giải quyết xung đột trước khi đẩy code (Rebase/Merge develop)
Trước khi push code lên GitHub, hãy đảm bảo nhánh của bạn không bị đi sau nhánh chung bằng cách:
```bash
git checkout feature/ten-tinh-nang-moi
git fetch origin
git merge origin/main
```
*Nếu có xung đột (conflict), hãy xem hướng dẫn xử lý ở Mục 5 trước khi tiếp tục.*

### Bước 5: Đẩy nhánh lên GitHub (Push branch)
Đẩy nhánh đã hoàn thiện và chạy ổn định lên GitHub:
```bash
git push origin feature/ten-tinh-nang-moi
```

### Bước 6: Tạo Pull Request (PR) & Review Code
1. Truy cập vào GitHub Repository của dự án.
2. Bạn sẽ thấy gợi ý tạo Pull Request cho nhánh vừa push. Nhấn **Compare & pull request**.
3. **Mô tả PR:** Viết mô tả ngắn gọn về những gì đã làm, cách kiểm tra tính năng và các task/issue liên quan.
4. **Reviewer:** Chọn ít nhất 1-2 thành viên trong nhóm để review code cho bạn.
5. **Chỉnh sửa (nếu có):** Nếu reviewer yêu cầu chỉnh sửa, hãy sửa trực tiếp trên nhánh đó ở local, commit và push tiếp lên remote. PR trên GitHub sẽ tự động cập nhật.
6. **Merge PR:** Khi đã nhận đủ phê duyệt (Approved) và các test/CI tự động thông qua, tiến hành chọn **Squash and merge** để gộp các commit phụ thành một commit sạch gọn trên nhánh chính.
7. **Xóa nhánh:** Xóa nhánh đã merge trên GitHub và cập nhật local của bạn:
   ```bash
   git checkout develop
   git pull origin develop
   git branch -d feature/ten-tinh-nang-moi
   ```

---

## 4. Quy Chuẩn Viết Commit Message (Conventional Commits)

Để lịch sử dự án chuyên nghiệp, chúng ta áp dụng chuẩn **Conventional Commits**.

### Cấu trúc thông điệp:
```text
<loại-commit>(<phạm-vi-ảnh-hưởng>): <mô tả ngắn bằng tiếng Việt hoặc tiếng Anh>
```

### Các loại commit (`<type>`) bắt buộc:
*   `feat`: Tính năng mới (New Feature).
*   `fix`: Sửa lỗi (Bug Fix).
*   `docs`: Cập nhật tài liệu (Documentation).
*   `style`: Định dạng code (khoảng trắng, dấu chấm phẩy, format... không ảnh hưởng logic).
*   `refactor`: Cấu trúc lại code (không sửa bug cũng không thêm tính năng mới).
*   `test`: Thêm mới hoặc sửa đổi mã nguồn kiểm thử (Unit test, Integration test).
*   `chore`: Các thay đổi lặt vặt khác (cấu hình build, cài thư viện mới, cập nhật docker-compose...).

### Ví dụ mẫu:
*   `feat(backend): thêm api lấy danh sách cảnh báo theo thời gian thực`
*   `fix(frontend): sửa lỗi lệch layout trên màn hình topology map`
*   `docs(github): tạo file hướng dẫn quy trình làm việc với git & github`
*   `chore(docker): cập nhật cấu hình cổng kết nối cho mosquitto broker`

---

## 5. Hướng Dẫn Giải Quyết Xung Đột (Resolve Merge Conflicts)

Khi có từ 2 người trở lên sửa cùng một dòng code ở các nhánh khác nhau và cùng merge vào nhánh chung, Git sẽ báo lỗi xung đột. Hãy bình tĩnh xử lý theo các bước sau:

1. Đảm bảo bạn đang ở nhánh làm việc của mình:
   ```bash
   git checkout feature/ten-tinh-nang-moi
   ```
2. Thực hiện merge nhánh chung vào nhánh của bạn:
   ```bash
   git fetch origin
   git merge origin/develop
   ```
3. Git sẽ thông báo danh sách các file bị conflict. Mở các file này bằng **VS Code**.
4. Bạn sẽ nhìn thấy các phần code xung đột được khoanh vùng bằng các ký hiệu:
   *   `<<<<<<< HEAD (Current Change)`: Code của bạn trên nhánh hiện tại.
   *   `=======` (Dấu ngăn cách).
   *   `>>>>>>> develop (Incoming Change)`: Code từ nhánh chung gửi tới.
5. Sử dụng giao diện của VS Code để chọn:
   *   **Accept Current Change:** Giữ code của bạn.
   *   **Accept Incoming Change:** Giữ code từ nhánh chung.
   *   **Accept Both Changes:** Giữ cả hai.
   *   Hoặc chỉnh sửa thủ công để kết hợp cả hai phần code một cách hợp lý.
6. Sau khi giải quyết xong conflict ở toàn bộ các file, lưu lại và chạy thử dự án xem có lỗi gì phát sinh không.
7. Thực hiện commit và push để lưu kết quả giải quyết xung đột:
   ```bash
   git add .
   git commit -m "merge: giải quyết xung đột với nhánh develop"
   git push origin feature/ten-tinh-nang-moi
   ```

---
