package hackathon.controller;

import hackathon.gemini.GeminiService;
import org.springframework.core.io.ClassPathResource;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.io.IOException;
import java.nio.file.Files;


@RestController
@RequestMapping("/gemini")
public class GeminiController {

    private final GeminiService geminiService;

    public GeminiController(GeminiService geminiService) {
        this.geminiService = geminiService;
    }

    @GetMapping("/ask-default")
    public String askDefault() {
        ClassPathResource resource = new ClassPathResource("hateSpeechPrompt.txt");
        String prePrompt = null;
        try {
            prePrompt = Files.readString(resource.getFile().toPath());
        } catch (IOException e) {
            System.err.println("Error reading file: " + e.getMessage());
        }
        String defaultPrompt = prePrompt + "Jednom rečju ,,teška ciganija \" i nikad više arapske zemlje jer oni su drugi svet ,zasto sebe i porodicu stavljati u rizik kad imamo bar kolko tolko civilizovanije zemlje gde možete letovati bez rizika da vam otmu dete i napastvuju ženu ili devojku.Slučaja ima previše.Trebe pritisnuti agencije pravno i priupitati šta oni to nude.";
        return geminiService.callGeminiApi(defaultPrompt);
    }

    @GetMapping("/ask")
    public String askWithQueryParam(@RequestParam String prompt) {
        return geminiService.callGeminiApi(prompt);
    }

    @PostMapping("/ask-body")
    public String askWithBody(@RequestBody PromptRequest promptRequest) {
        return geminiService.callGeminiApi(promptRequest.getPrompt());
    }

    public static class PromptRequest {
        private String prompt;

        public String getPrompt() {
            return prompt;
        }

        public void setPrompt(String prompt) {
            this.prompt = prompt;
        }
    }
}