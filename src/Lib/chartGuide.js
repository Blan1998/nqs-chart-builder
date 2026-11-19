// Mô tả ngắn từng loại, dùng để AI gợi ý loại phù hợp với dữ liệu
export const CHART_GUIDE = {
  pie: 'Tỷ lệ các phần trong một tổng (cơ cấu, thị phần). Phù hợp khi có ít phần (dưới 7).',
  bar: 'So sánh giá trị giữa các danh mục hoặc các mốc thời gian. Thêm cột giá trị thì thành các cột cạnh nhau để so sánh nhiều chuỗi.',
  line: 'Xu hướng theo thời gian của một hoặc nhiều chuỗi, nhìn tăng giảm qua các mốc.',
  combo: 'Kết hợp cột và đường, dùng khi hai chuỗi khác đơn vị hoặc khác quy mô.',
  stackedBar: 'Cơ cấu của tổng theo từng mốc, các phần cộng lại thành tổng, có thể chuyển 100%.',
  stackedArea: 'Vùng chồng: thay đổi cơ cấu (hoặc tổng) của nhiều thành phần qua các mốc thời gian, có thể chuyển 100%.',
  divBar: 'Thanh ngang tăng/giảm: so sánh mức tăng (xanh) và giảm (đỏ) của nhiều đối tượng quanh mức 0, xếp từ tăng nhiều đến giảm nhiều.',
  rangeDot: 'Dải lịch sử và giá trị hiện tại: so sánh mức hiện tại (ví dụ P/E) của nhiều doanh nghiệp với dải lịch sử của chính nó (tứ phân vị và trung vị).',
  rankBar: 'Xếp hạng các danh mục theo một giá trị, từ lớn đến nhỏ.',
  barRace: 'Đua thanh: thứ hạng các quốc gia/đối tượng thay đổi theo từng năm, có cờ và khu vực. Dùng khi dữ liệu có nhiều mốc thời gian và nhiều đối tượng.',
  lineRank: 'Đường xếp hạng theo năm: so sánh giá trị hoặc thứ hạng của nhiều đối tượng qua các mốc thời gian.',
};
