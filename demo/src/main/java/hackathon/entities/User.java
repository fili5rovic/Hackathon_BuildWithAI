package hackathon.entities;

import jakarta.persistence.*;

@Entity
@Table(name = "\"user\"")

@NamedQueries({
    @NamedQuery(name = "User.findAll", query = "SELECT u FROM User u"),
    @NamedQuery(name = "User.findById", query = "SELECT u FROM User u WHERE u.id = :id")
})
public class User {
    @Id
    @GeneratedValue
    private Long id;
    private String name;

    // Constructors
    public User() {
    }

    public User(String name) {
        this.name = name;
    }

    // Getters and setters
    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public void setName(String name) {
        this.name = name;
    }
}
