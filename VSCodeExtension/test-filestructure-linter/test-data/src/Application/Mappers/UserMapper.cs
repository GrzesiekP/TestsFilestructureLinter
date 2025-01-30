namespace Application.Mappers;

public class UserMapper
{
    public UserDto MapToDto(User user)
    {
        return new UserDto
        {
            Id = user.Id,
            Name = user.Name,
            Email = user.Email
        };
    }
} 