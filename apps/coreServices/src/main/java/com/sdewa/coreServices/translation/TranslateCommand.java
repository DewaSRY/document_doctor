import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.Builder;

import java.util.List;
import java.util.Objects;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TranslateCommand {
    private String text;
    private String sourceLanguage;
    private String targetLanguage;
    private List<String> emotionTags = List.of();
    private List<String> voiceTags = List.of();
}