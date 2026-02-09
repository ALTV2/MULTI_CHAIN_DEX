package com.multichain.dex.domain.entity;

import com.multichain.dex.domain.enums.ChainType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "wallets", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"user_id", "address", "chain"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Wallet {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 42)
    private String address;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ChainType chain;

    @Column(length = 50)
    private String label;

    @Column(columnDefinition = "TEXT")
    private String encryptedPrivateKey;

    @Column(nullable = false)
    @Builder.Default
    private boolean imported = false;

    @Column(nullable = false)
    @Builder.Default
    private boolean isPrimary = false;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;
}
