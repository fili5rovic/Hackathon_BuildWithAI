package hackathon.gemini;

import java.util.List;

public class Content {
    private List<Part> parts;

    // Constructor
    public Content(List<Part> parts) {
        this.parts = parts;
    }

    // Getters and Setters
    public List<Part> getParts() {
        return parts;
    }

    public void setParts(List<Part> parts) {
        this.parts = parts;
    }
}
